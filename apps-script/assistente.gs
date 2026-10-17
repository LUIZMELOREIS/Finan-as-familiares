/**
 * assistente.gs — Assistente financeiro da família (tela Assistente e bot do Telegram).
 *
 * Como funciona:
 *  1. montarResumoAgregado(): o servidor resume os dados da planilha (totais por categoria/grupo/mês
 *     dos últimos 12 meses, médias de 3 meses, contas a vencer, projetos com ritmo, assinaturas
 *     detectadas e os apelidos dos membros). Nada mais pessoal vai para a IA.
 *  2. Com CHAVE_API_CLAUDE: conversa com o Claude (Messages API) usando *tool use*. As ferramentas
 *     buscar_lancamentos, total_por_categoria, projetar_meta, lancar_despesa e proximas_saidas são
 *     executadas aqui, na planilha, e o resultado volta ao modelo até a resposta final (máx. 6 voltas).
 *     O modelo responde curto, em português, com valores "R$ 1.234,56" e, quando compara coisas,
 *     termina com uma linha JSON {"barras":[...]} que o servidor extrai para a mini-barra do app.
 *  3. Sem chave: responderLocal() resolve as perguntas mais comuns por regras (gasto por categoria,
 *     assinaturas, contas da semana, fechamento do mês, onde economizar, projetos) e lança por texto.
 *     É o mesmo comportamento do modo demonstração (app/src/api/mock.ts).
 *  4. Cada conversa fica na aba Conversas, por usuário.
 */

const MAX_VOLTAS_FERRAMENTAS = 6;
const MAX_MENSAGENS_HISTORICO = 10;
const MAX_CONVERSA_POR_USUARIO = 200;

// ---------- Resumo agregado (o que a IA recebe) ----------

/** Resumo agregado dos dados (função pura). */
function montarResumoAgregado(d, visao, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const catMap = indexarPorId(d.categorias);
  const grpMap = indexarPorId(d.grupos);
  const ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const c = somarMeses(comp, -i);
    const r = calcularResumoMes(d, visao, c);
    const porCategoria = {};
    Object.keys(r.por_categoria).forEach((id) => { if (r.por_categoria[id].realizado) porCategoria[id] = r.por_categoria[id].realizado; });
    meses.push({ competencia: c, entrou: r.entrou, saiu: r.saiu, sobrou: r.sobrou, por_tipo: r.por_tipo, por_categoria: porCategoria });
  }
  const despesas = ls.filter((l) => l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
  const medias3m = {};
  d.categorias.filter((c) => c.tipo === 'despesa').forEach((c) => {
    const m = mediaCategoria3m(despesas, c.id, comp);
    if (m) medias3m[c.id] = arredondar(m);
  });
  return {
    hoje: h,
    competencia_atual: comp,
    membros: d.usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, apelido: u.apelido, perfil: normalizarPerfil(u.perfil) })),
    tipos: d.tipos.map((t) => ({ id: t.id, nome: t.nome })),
    categorias: d.categorias.filter((c) => c.ativa && (!c.sensivel || !visao || visao.ver_sensivel !== false)).map((c) => ({ id: c.id, nome: c.nome, tipo_id: c.tipo_id, grupo: grpMap[c.grupo_id] ? grpMap[c.grupo_id].nome : '', orcamento_mensal: c.orcamento_mensal || 0 })),
    meses,
    medias_3m_por_categoria: medias3m,
    proximas_saidas_30d: calcularProximasSaidas(d, 30, h).map((s) => ({ data: s.data, titulo: s.titulo, valor: s.valor, status: s.status })),
    projetos: d.projetos.filter((p) => p.status !== 'concluído').map((p) => { const pc = comProjetoCalculado(d, p, h); return { id: p.id, nome: p.nome, meta: p.meta_valor, guardado: pc.valor_atual, data_alvo: p.data_alvo, necessario_mes: pc.necessario_mes, media_3m: pc.media_3m, situacao: pc.situacao, status: p.status }; }),
    assinaturas: detectarAssinaturas(d, h).map((a) => ({ nome: a.estabelecimento, valor: a.valor, desde: a.desde, nova: a.nova })),
    decisoes_abertas: d.decisoes.filter((x) => x.status === 'aberta').map((x) => ({ titulo: x.titulo, prazo: x.prazo })),
  };
}

// ---------- Ferramentas (tool use) ----------

/** Definições das ferramentas no formato da Messages API. */
function ferramentasAssistente() {
  return [
    { name: 'buscar_lancamentos', description: 'Lista lançamentos da família com filtros. Use para detalhar gastos (ex.: as compras de delivery do mês).',
      input_schema: { type: 'object', properties: { competencia: { type: 'string', description: 'AAAA-MM' }, categoria_id: { type: 'string' }, grupo_id: { type: 'string' }, tipo_id: { type: 'string' }, usuario_id: { type: 'string' }, texto: { type: 'string', description: 'trecho do estabelecimento ou descrição' }, limite: { type: 'integer' } } } },
    { name: 'total_por_categoria', description: 'Total gasto numa categoria ou grupo numa competência, com a média dos 3 meses anteriores.',
      input_schema: { type: 'object', properties: { competencia: { type: 'string', description: 'AAAA-MM' }, categoria_id: { type: 'string' }, grupo_id: { type: 'string' } }, required: ['competencia'] } },
    { name: 'projetar_meta', description: 'Projeta um projeto (meta de poupança): quanto falta, quanto guardar por mês e quando fecha no ritmo atual; aceita um corte mensal extra (ex.: reduzir delivery em R$ 130).',
      input_schema: { type: 'object', properties: { projeto_id: { type: 'string' }, corte_mensal: { type: 'number', description: 'valor extra por mês direcionado ao projeto' } }, required: ['projeto_id'] } },
    { name: 'lancar_despesa', description: 'Registra um lançamento (despesa ou receita) na planilha. Só use quando a pessoa pediu claramente para lançar/registrar algo.',
      input_schema: { type: 'object', properties: { valor: { type: 'number' }, categoria_id: { type: 'string' }, descricao: { type: 'string' }, estabelecimento: { type: 'string' }, forma_pgto: { type: 'string', enum: ['dinheiro', 'pix', 'débito', 'crédito', 'boleto'] }, data: { type: 'string', description: 'AAAA-MM-DD (padrão hoje)' } }, required: ['valor', 'categoria_id'] } },
    { name: 'proximas_saidas', description: 'Contas, parcelas, assinaturas e faturas previstas para os próximos 30, 60 ou 90 dias.',
      input_schema: { type: 'object', properties: { dias: { type: 'integer', enum: [30, 60, 90] } } } },
  ];
}

/** Executa uma ferramenta na planilha. Devolve um objeto serializável (ou { erro }). */
function executarFerramentaAssistente(nome, entrada, ctx, estado) {
  const e = entrada || {};
  const d = carregarDados();
  const visao = visaoDe(ctx);
  if (nome === 'buscar_lancamentos') {
    let ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
    if (ctx.ehDependente) ls = ls.filter((l) => l.usuario_id === ctx.uid);
    const cats = d.categorias;
    if (e.competencia) ls = ls.filter((l) => l.competencia === e.competencia);
    if (e.categoria_id) ls = ls.filter((l) => l.categoria_id === e.categoria_id);
    if (e.grupo_id) { const ids = cats.filter((c) => c.grupo_id === e.grupo_id).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); }
    if (e.tipo_id) { const ids = cats.filter((c) => c.tipo_id === e.tipo_id).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); }
    if (e.usuario_id) ls = ls.filter((l) => l.usuario_id === e.usuario_id);
    if (e.texto) { const t = normalizar(e.texto); ls = ls.filter((l) => normalizar(l.estabelecimento + ' ' + l.descricao).indexOf(t) >= 0); }
    const limite = Math.min(Number(e.limite) || 30, 100);
    const userMap = indexarPorId(d.usuarios);
    return { total: arredondar(somar(ls, (l) => l.valor)), quantidade: ls.length, lancamentos: ls.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, limite).map((l) => ({ data: l.data, valor: l.valor, categoria_id: l.categoria_id, descricao: l.descricao, estabelecimento: l.estabelecimento, forma_pgto: l.forma_pgto, quem: userMap[l.usuario_id] ? userMap[l.usuario_id].apelido : '' })) };
  }
  if (nome === 'total_por_categoria') {
    const comp = e.competencia || competenciaDe();
    const despesas = despesasConfirmadas(Object.assign({}, d, { lancamentos: lancamentosVisiveis(d, visao) }));
    const ids = e.categoria_id ? [e.categoria_id] : d.categorias.filter((c) => c.grupo_id === e.grupo_id).map((c) => c.id);
    const total = somar(ids, (id) => totalCategoriaNoMes(despesas, id, comp));
    const med = somar(ids, (id) => mediaCategoria3m(despesas, id, comp));
    const porMes = [0, 1, 2, 3].map((k) => { const c = somarMeses(comp, -k); return { competencia: c, total: arredondar(somar(ids, (id) => totalCategoriaNoMes(despesas, id, c))) }; });
    return { competencia: comp, total: arredondar(total), media_3m: arredondar(med), variacao_pct: med ? Math.round((total / med - 1) * 100) : null, por_mes: porMes, quantidade: despesas.filter((l) => l.competencia === comp && ids.indexOf(l.categoria_id) >= 0).length };
  }
  if (nome === 'projetar_meta') {
    const pr = d.projetos.find((x) => x.id === e.projeto_id) || d.projetos.find((x) => normalizar(x.nome).indexOf(normalizar(e.projeto_id)) >= 0);
    if (!pr) return { erro: 'Projeto não encontrado. Projetos: ' + d.projetos.map((x) => x.id + ' (' + x.nome + ')').join(', ') };
    return projetarMeta(d, pr, Number(e.corte_mensal) || 0);
  }
  if (nome === 'lancar_despesa') {
    const cat = d.categorias.find((c) => c.id === e.categoria_id);
    if (!cat) return { erro: 'categoria_id inválido' };
    const l = acaoSalvarLancamento({ lancamento: { valor: e.valor, categoria_id: e.categoria_id, descricao: e.descricao || cat.nome, estabelecimento: e.estabelecimento || '', forma_pgto: e.forma_pgto || 'pix', data: e.data || hojeIso(), origem: estado && estado.origem ? estado.origem : 'chat' } }, ctx)[0];
    if (estado) estado.lancamento = l;
    return { ok: true, lancamento: { id: l.id, valor: l.valor, categoria: cat.nome, data: l.data, forma_pgto: l.forma_pgto } };
  }
  if (nome === 'proximas_saidas') {
    return { saidas: calcularProximasSaidas(d, [30, 60, 90].indexOf(Number(e.dias)) >= 0 ? Number(e.dias) : 30).map((s) => ({ data: s.data, titulo: s.titulo, valor: s.valor, status: s.status })) };
  }
  return { erro: 'Ferramenta desconhecida: ' + nome };
}

/** Projeção de um projeto (função pura): falta, necessário/mês, meses no ritmo atual, com corte extra. */
function projetarMeta(d, projeto, corteMensal, hoje) {
  const pc = comProjetoCalculado(d, projeto, hoje);
  const falta = Math.max(0, projeto.meta_valor - pc.valor_atual);
  const ritmo = pc.media_3m + (Number(corteMensal) || 0);
  const comp = (hoje || hojeIso()).slice(0, 7);
  const mesesNoRitmo = ritmo > 0 ? Math.ceil(falta / ritmo) : null;
  const alvo = String(projeto.data_alvo || '').slice(0, 7);
  const pa = alvo.split('-').map(Number), ph = comp.split('-').map(Number);
  const mesesAlvo = pa[0] && pa[1] ? Math.max(1, (pa[0] - ph[0]) * 12 + (pa[1] - ph[1])) : null;
  return {
    projeto: projeto.nome, meta: projeto.meta_valor, guardado: pc.valor_atual, falta: arredondar(falta), necessario_mes: pc.necessario_mes, media_3m: pc.media_3m,
    corte_mensal: Number(corteMensal) || 0, ritmo_considerado: arredondar(ritmo), meses_no_ritmo: mesesNoRitmo,
    fecha_em: mesesNoRitmo ? somarMeses(comp, mesesNoRitmo) : null, data_alvo: projeto.data_alvo, meses_ate_alvo: mesesAlvo,
    percentual_no_alvo: mesesAlvo ? Math.min(100, Math.round(((pc.valor_atual + ritmo * mesesAlvo) / (projeto.meta_valor || 1)) * 100)) : null,
    no_prazo: mesesNoRitmo !== null && mesesAlvo !== null ? mesesNoRitmo <= mesesAlvo : false, situacao: pc.situacao,
  };
}

// ---------- Conversa com o Claude ----------

/** System prompt em português. */
function sistemaAssistente(resumo, usuario) {
  return 'Você é o assistente financeiro da ' + (resumo.nome_familia || 'família') + ', dentro do app "Finanças da Família" (controle financeiro doméstico, base cristã de mordomia: Deus é o dono, nós administramos). ' +
    'Fala com ' + (usuario ? usuario.apelido : 'um membro da família') + '. Responda SEMPRE em português do Brasil, de forma curta e direta (no máximo 4 frases), com números no formato R$ 1.234,56 e datas dd/mm/aaaa. ' +
    'Use os dados do resumo abaixo e, quando precisar de detalhe, as ferramentas (buscar_lancamentos, total_por_categoria, projetar_meta, proximas_saidas). ' +
    'Só use lancar_despesa quando a pessoa pedir claramente para lançar/registrar um gasto ou receita; depois confirme o que foi lançado. ' +
    'Quando houver comparação entre valores (mês × média, categorias, receitas × despesas), termine a resposta com UMA linha separada contendo só JSON no formato ' +
    '{"barras":[{"rotulo":"Outubro","valor":812.4,"cor":"magenta"},{"rotulo":"Média 3 meses","valor":620,"cor":"indigo"}]} (no máximo 5 barras; cores possíveis: indigo, magenta, gold, orange, green, red, lilac, rose, slate). ' +
    'Nunca invente números: se não souber, diga que não encontrou. Nunca mencione tokens, chaves ou dados de cartão. Tom sério e respeitoso, sem emojis, sem culpa.\n\n' +
    'RESUMO DOS DADOS (JSON):\n' + JSON.stringify(resumo);
}

/** Converte o histórico do app em mensagens da API (só texto, últimas N). */
function historicoParaMensagens(historico) {
  const lista = Array.isArray(historico) ? historico.slice(-MAX_MENSAGENS_HISTORICO) : [];
  const msgs = [];
  lista.forEach((m) => {
    if (!m || !m.texto) return;
    const papel = m.papel === 'eu' ? 'user' : 'assistant';
    // A API exige alternância; funde mensagens seguidas do mesmo papel.
    if (msgs.length && msgs[msgs.length - 1].role === papel) msgs[msgs.length - 1].content += '\n' + String(m.texto);
    else msgs.push({ role: papel, content: String(m.texto) });
  });
  if (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

/**
 * Extrai a linha final {"barras":[...]} do texto (função pura).
 * Devolve { texto (sem a linha), barras (array ou undefined) }.
 */
function extrairBarras(texto) {
  const linhas = String(texto || '').trim().split('\n');
  for (let i = linhas.length - 1; i >= 0 && i >= linhas.length - 3; i--) {
    const ln = linhas[i].trim().replace(/^```json|^```|```$/g, '').trim();
    if (!/^\{\s*"barras"\s*:/.test(ln)) continue;
    try {
      const j = JSON.parse(ln);
      if (!Array.isArray(j.barras)) continue;
      const barras = j.barras.filter((b) => b && b.rotulo !== undefined && !isNaN(Number(b.valor))).slice(0, 5)
        .map((b) => semUndefined({ rotulo: String(b.rotulo).slice(0, 24), valor: arredondar(b.valor), cor: ['indigo', 'sel', 'magenta', 'gold', 'orange', 'green', 'red', 'lilac', 'rose', 'slate'].indexOf(b.cor) >= 0 ? b.cor : undefined }));
      linhas.splice(i, 1);
      return { texto: linhas.join('\n').replace(/```json\s*```/g, '').trim(), barras: barras.length ? barras : undefined };
    } catch (e) { /* não era JSON válido: segue */ }
  }
  return { texto: String(texto || '').trim(), barras: undefined };
}

/**
 * Conversa com o Claude usando tool use. Devolve { texto, barras, lancamento }.
 * `imagem` opcional: { base64, mime } (foto anexada à conversa).
 */
function conversarComClaude(ctx, mensagem, historico, imagem, origem) {
  const d = carregarDados();
  const resumo = montarResumoAgregado(d, visaoDe(ctx));
  resumo.nome_familia = d.config.nome_familia;
  const conteudo = [];
  if (imagem && imagem.base64) conteudo.push(blocoArquivo(imagem.base64, imagem.mime || 'image/jpeg'));
  conteudo.push({ type: 'text', text: mensagem || (imagem ? 'Leia este cupom e me diga o que lançar.' : '') });
  const mensagens = historicoParaMensagens(historico).concat([{ role: 'user', content: conteudo }]);
  const estado = { lancamento: null, origem: origem || 'chat' };
  const corpo = { model: propriedade('MODELO_CLAUDE', MODELO_CLAUDE_PADRAO), max_tokens: 1024, system: sistemaAssistente(resumo, ctx.usuario), tools: ferramentasAssistente(), messages: mensagens };
  let textoFinal = '';
  for (let volta = 0; volta < MAX_VOLTAS_FERRAMENTAS; volta++) {
    const json = requisicaoClaude(corpo);
    const blocos = json.content || [];
    textoFinal = blocos.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (json.stop_reason !== 'tool_use') break;
    corpo.messages.push({ role: 'assistant', content: blocos });
    const resultados = blocos.filter((b) => b.type === 'tool_use').map((b) => {
      let r;
      try { r = executarFerramentaAssistente(b.name, b.input, ctx, estado); } catch (e) { r = { erro: e.message }; }
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(r).slice(0, 20000) };
    });
    corpo.messages.push({ role: 'user', content: resultados });
  }
  const r = extrairBarras(textoFinal);
  return { texto: r.texto || 'Não consegui montar uma resposta agora. Tente perguntar de outro jeito.', barras: r.barras, lancamento: estado.lancamento };
}

// ---------- Respostas por regras locais (sem chave) ----------

/**
 * Categoria citada num texto já normalizado (função pura): compara nome e palavras-chave com
 * fronteira de palavra ("GAS" não casa com "GASTAMOS") e prefere o termo mais longo.
 */
function encontrarCategoriaNoTexto(textoNormalizado, categorias) {
  const t = ' ' + String(textoNormalizado || '') + ' ';
  let melhor = null, tamanho = 0;
  (categorias || []).forEach((c) => {
    const termos = [normalizar(c.nome)].concat(String(c.palavras_chave || '').split(';').map((p) => normalizar(p))).filter((x) => x.length >= 3);
    termos.forEach((termo) => {
      if (termo.length > tamanho && t.indexOf(' ' + termo + ' ') >= 0) { melhor = c; tamanho = termo.length; }
    });
  });
  return melhor;
}

/**
 * Responde às perguntas mais comuns sem IA (função pura, igual ao mock).
 * Devolve { texto, barras?, lancamento? (objeto a gravar), etiqueta? }.
 */
function responderLocal(d, visao, uid, texto, hoje) {
  const h = hoje || hojeIso();
  const t = normalizar(texto);
  const comp = h.slice(0, 7);
  const mesNome = nomeMes(comp);
  const catMap = indexarPorId(d.categorias);
  const ls = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado');
  const despesas = ls.filter((l) => l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
  const total = (cid, c) => totalCategoriaNoMes(despesas, cid, c);
  const media3 = (cid) => mediaCategoria3m(despesas, cid, comp);
  const categoriasVisiveisLocal = d.categorias.filter((c) => c.ativa && !c.oculta_cardapio && (!c.sensivel || !visao || visao.ver_sensivel !== false));

  // 1. Lançamento por texto.
  if (/^(GASTEI|PAGUEI|COMPREI|LANCA|LANCE|LANCAR|REGISTRA|REGISTRE|RECEBI|GANHEI)\b/.test(t) || /\bREAIS?\b|R\$/.test(t)) {
    const e = extrairDeTexto(texto, categoriasVisiveisLocal);
    const regra = e.estabelecimento ? regraDaLoja(e.estabelecimento, d.regras_loja) : null;
    if (regra) e.categoria_id = regra.categoria_id;
    if (e.valor && e.categoria_id && catMap[e.categoria_id]) {
      const c = catMap[e.categoria_id];
      const g = d.grupos.find((x) => x.id === c.grupo_id);
      const tp = d.tipos.find((x) => x.id === c.tipo_id);
      const data = e.data || h;
      const lanc = { data, competencia: competenciaDe(data), tipo: c.tipo, valor: e.valor, categoria_id: c.id, descricao: e.descricao || c.nome, estabelecimento: e.estabelecimento || '', forma_pgto: e.forma_pgto || 'pix', usuario_id: uid, origem: 'chat', status: 'confirmado' };
      const quem = (d.usuarios.find((u) => u.id === uid) || {}).apelido || '';
      const forma = lanc.forma_pgto.charAt(0).toUpperCase() + lanc.forma_pgto.slice(1);
      return { texto: 'Lancei **' + moeda(lanc.valor) + ' · ' + c.nome + '** (' + (tp ? tp.nome : '') + ' › ' + (g ? g.nome : '') + '), ' + (data === h ? 'hoje' : dataBr(data)) + ', ' + forma + (quem ? ', por ' + quem : '') + '.', lancamento: lanc, etiqueta: 'lançado' };
    }
    return { texto: 'Não entendi o valor. Tente assim: “gastei 45 na padaria no pix”.' };
  }
  // 2. Gasto por categoria no mês.
  const cat = encontrarCategoriaNoTexto(t, d.categorias.filter((c) => c.tipo === 'despesa' && ehDespesaReal(c)));
  if (cat && /QUANTO|GAST|TOTAL/.test(t)) {
    const atual = total(cat.id, comp);
    const med = media3(cat.id);
    const doMes = despesas.filter((l) => l.categoria_id === cat.id && l.competencia === comp);
    const maior = doMes.slice().sort((a, b) => b.valor - a.valor)[0];
    const variacao = med ? Math.round((atual / med - 1) * 100) : 0;
    return {
      texto: 'Em ' + mesNome + ' foram **' + moeda(atual) + '** em ' + doMes.length + ' lançamento' + (doMes.length === 1 ? '' : 's') + ' de ' + cat.nome + ' — ' + (variacao >= 0 ? variacao + '% acima' : (-variacao) + '% abaixo') + ' da média dos últimos 3 meses (' + moeda(med) + ').' + (maior ? ' O maior foi ' + moeda(maior.valor) + ' no dia ' + maior.data.slice(8, 10) + '.' : ''),
      barras: [{ rotulo: MESES_PT[Number(comp.slice(5)) - 1], valor: arredondar(atual), cor: cat.cor }, { rotulo: 'Média 3 meses', valor: Math.round(med), cor: 'indigo' }],
    };
  }
  // 3. Assinaturas.
  if (/ASSINATURA/.test(t)) {
    const itens = ls.filter((l) => l.competencia === comp && CATEGORIAS_ASSINATURA.indexOf(l.categoria_id) >= 0);
    const soma = somar(itens, (l) => l.valor);
    if (!itens.length) return { texto: 'Não encontrei assinaturas lançadas em ' + mesNome + ' (categorias Streaming, Aplicativos e Seguros diversos).' };
    return { texto: 'Temos ' + itens.length + ' assinatura' + (itens.length > 1 ? 's' : '') + ' este mês, somando **' + moeda(soma) + '**: ' + itens.map((l) => l.descricao + ' (' + moeda(l.valor) + ')').join(', ') + '.', barras: itens.slice(0, 5).map((l) => ({ rotulo: String(l.descricao).slice(0, 14), valor: arredondar(l.valor), cor: 'rose' })) };
  }
  // 4. Contas da semana.
  if (/VENCE|SEMANA|CONTAS/.test(t)) {
    const s = calcularProximasSaidas(d, 7, h);
    if (!s.length) return { texto: 'Nenhuma conta vence nos próximos 7 dias.' };
    return { texto: 'Vencem nos próximos 7 dias: ' + s.map((x) => x.titulo + ' (' + moeda(x.valor) + ', dia ' + x.data.slice(8, 10) + ')').join('; ') + '. Total **' + moeda(somar(s, (x) => x.valor)) + '**.' };
  }
  // 5. Fechamento do mês.
  if (/FECHAMOS|FECHOU|COMO FOI|SALDO/.test(t)) {
    let idx = -1;
    MESES_PT.forEach((m, i) => { if (t.indexOf(normalizar(m)) >= 0) idx = i; });
    const c = idx >= 0 ? comp.slice(0, 4) + '-' + zeros(idx + 1) : somarMeses(comp, -1);
    const r = calcularResumoMes(d, visao, c);
    return {
      texto: nomeCompetencia(c) + ': entrou **' + moeda(r.entrou) + '**, saiu **' + moeda(r.saiu) + '** e ' + (r.sobrou >= 0 ? 'sobrou **' + moeda(r.sobrou) + '**' : 'faltou **' + moeda(-r.sobrou) + '**') + '. Despesas fixas ' + moeda(r.por_tipo[TIPO_FIXAS] ? r.por_tipo[TIPO_FIXAS].realizado : 0) + ' e variáveis ' + moeda(r.por_tipo[TIPO_VARIAVEIS] ? r.por_tipo[TIPO_VARIAVEIS].realizado : 0) + '.',
      barras: [{ rotulo: 'Receitas', valor: r.entrou, cor: 'green' }, { rotulo: 'Despesas', valor: r.saiu, cor: 'magenta' }],
    };
  }
  // 6. Onde economizar.
  if (/ECONOMIZAR|CORTAR|REDUZIR/.test(t)) {
    const variaveis = d.categorias.filter((c) => c.tipo_id === TIPO_VARIAVEIS && ehDespesaReal(c)).map((c) => ({ c, atual: total(c.id, comp), media: media3(c.id) })).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO).sort((a, b) => (b.atual - b.media) - (a.atual - a.media)).slice(0, 3);
    if (!variaveis.length) return { texto: 'Ainda não há histórico suficiente para comparar os gastos variáveis com a média de 3 meses.' };
    return {
      texto: 'Onde mais subimos em relação à média: ' + variaveis.map((x) => '**' + x.c.nome + '** (' + moeda(x.atual) + ' contra ' + moeda(x.media) + ')').join(', ') + '. Voltar esses três à média liberaria cerca de **' + moeda(somar(variaveis, (x) => Math.max(0, x.atual - x.media))) + '** por mês.',
      barras: variaveis.map((x) => ({ rotulo: x.c.nome.slice(0, 14), valor: Math.round(x.atual), cor: x.c.cor })),
    };
  }
  // 7. Projetos.
  const proj = d.projetos.find((p) => t.indexOf(normalizar(p.nome)) >= 0 || (/VIAGEM/.test(t) && /VIAGEM/.test(normalizar(p.nome))) || (/CARRO/.test(t) && /CARRO/.test(normalizar(p.nome))) || (/RESERVA/.test(t) && /RESERVA/.test(normalizar(p.nome))));
  if (proj && /FECHAR|CONSEGU|DA PARA|RITMO|FALTA|PROJETO|META/.test(t)) {
    const pm = projetarMeta(d, proj, 0, h);
    const delivery = Math.max(0, total('c_delivery', comp) - media3('c_delivery'));
    return { texto: 'No ritmo atual (' + moeda(pm.media_3m) + '/mês) o projeto **' + proj.nome + '** chega a ' + (pm.percentual_no_alvo === null ? '?' : pm.percentual_no_alvo) + '% da meta em ' + nomeCompetencia(String(proj.data_alvo).slice(0, 7), true) + '. Faltam ' + moeda(pm.falta) + '; precisa de ' + moeda(pm.necessario_mes) + ' por mês.' + (delivery > 20 ? ' Reduzindo delivery para a média (−' + moeda(delivery) + '/mês) e direcionando a sobra do mês, a meta fecha ' + (pm.no_prazo ? 'no prazo' : 'mais perto do prazo') + '.' : '') };
  }
  return { texto: 'Posso responder sobre gastos por categoria (“quanto gastamos com delivery este mês?”), assinaturas, contas da semana, fechamento do mês, onde economizar e os projetos. Também lanço despesas: “gastei 120 no posto”. Com a chave do Claude configurada, a conversa fica livre.' };
}

// ---------- Ação principal ----------

/** Monta a MensagemAssistente de resposta. */
function mensagemAssistente(texto, extra) {
  return semUndefined(Object.assign({ id: gerarId('m'), papel: 'assistente', texto, data: agoraIso() }, extra || {}));
}

/**
 * Núcleo do assistente (usado pela API e pelo Telegram). Devolve a MensagemAssistente de resposta e
 * grava as duas mensagens na aba Conversas.
 * @param ctx contexto do usuário; @param mensagem texto; @param historico MensagemAssistente[]; @param imagem {base64, mime}|null
 */
function responderAssistente(ctx, mensagem, historico, imagem, origem) {
  const texto = String(mensagem || '').trim();
  if (!texto && !(imagem && imagem.base64)) throw new ErroUsuario('Escreva uma pergunta ou anexe uma foto.');
  let resposta;
  if (claudeDisponivel()) {
    try {
      const r = conversarComClaude(ctx, texto, historico, imagem, origem);
      resposta = mensagemAssistente(r.texto, { barras: r.barras, lancamento: r.lancamento ? lancamentoPublico(r.lancamento) : undefined, etiqueta: r.lancamento ? 'lançado' : undefined });
    } catch (e) {
      console.warn('Assistente: Claude falhou, usando regras locais: ' + e.message);
      resposta = null;
    }
  }
  if (!resposta && imagem && imagem.base64) resposta = responderFotoLocal(ctx, imagem, origem);
  if (!resposta) {
    const d = carregarDados();
    const r = responderLocal(d, visaoDe(ctx), ctx.uid, texto);
    let lanc;
    if (r.lancamento) {
      lanc = acaoSalvarLancamento({ lancamento: Object.assign({}, r.lancamento, { origem: origem || 'chat' }) }, ctx)[0];
    }
    resposta = mensagemAssistente(r.texto, { barras: r.barras, lancamento: lanc, etiqueta: lanc ? 'lançado' : undefined });
  }
  gravarConversa(ctx.uid, [{ id: gerarId('m'), papel: 'eu', texto: texto || '(foto)', data: agoraIso() }, resposta]);
  return resposta;
}

/** Sem IA: lê a foto do cupom (leitura.gs) e lança o que conseguir extrair. */
function responderFotoLocal(ctx, imagem, origem) {
  const mime = imagem.mime || 'image/jpeg';
  const blob = Utilities.newBlob(Utilities.base64Decode(imagem.base64), mime, nomeArquivoLeitura('cupom', mime, ''));
  const salvo = salvarArquivoLeitura(blob, 'cupom', blob.getName());
  const leitura = lerDocumento(imagem.base64, mime, 'cupom', blob, ctx);
  if (!(leitura.valor > 0) || !leitura.categoria_id) return mensagemAssistente('Não consegui ler o valor do cupom. Tente outra foto, com mais luz, ou digite: “gastei 45 na padaria”.');
  const l = acaoSalvarLancamento({ lancamento: { valor: leitura.valor, data: leitura.data || hojeIso(), categoria_id: leitura.categoria_id, descricao: leitura.descricao || leitura.estabelecimento || '', estabelecimento: leitura.estabelecimento || '', forma_pgto: leitura.forma_pgto || 'débito', anexo_url: salvo.url, origem: origem || 'foto' } }, ctx)[0];
  const cat = buscarPorId('Categorias', l.categoria_id);
  return mensagemAssistente('Lancei **' + moeda(l.valor) + ' · ' + (cat ? cat.nome : '') + '** de ' + (l.estabelecimento || 'cupom') + ', ' + dataBr(l.data) + '. Se a categoria estiver errada, corrija na lista de lançamentos.', { lancamento: l, etiqueta: 'lançado' });
}

/** assistente: resposta à mensagem (texto e/ou foto) do usuário. */
function acaoAssistente(p, ctx) {
  const imagem = p.imagem_base64 ? { base64: String(p.imagem_base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''), mime: String(p.mime || 'image/jpeg').toLowerCase() } : null;
  return responderAssistente(ctx, p.mensagem, p.historico, imagem, 'chat');
}

// ---------- Histórico (aba Conversas) ----------

/** Grava as mensagens do usuário na aba Conversas e mantém só as últimas MAX_CONVERSA_POR_USUARIO. */
function gravarConversa(uid, mensagens) {
  try {
    inserirLinhas('Conversas', mensagens.map((m) => ({
      id: m.id, usuario_id: uid, papel: m.papel, texto: String(m.texto || '').slice(0, 4000), data: m.data,
      barras: m.barras ? JSON.stringify(m.barras) : '', lancamento_id: m.lancamento ? m.lancamento.id : '', etiqueta: m.etiqueta || '',
    })));
    const minhas = lerAba('Conversas').filter((c) => c.usuario_id === uid);
    if (minhas.length > MAX_CONVERSA_POR_USUARIO + 50) {
      const apagar = {};
      minhas.sort((a, b) => (a.data < b.data ? -1 : 1)).slice(0, minhas.length - MAX_CONVERSA_POR_USUARIO).forEach((c) => { apagar[c.id] = true; });
      removerLinhas('Conversas', (c) => apagar[c.id]);
    }
  } catch (e) { console.warn('Não gravei a conversa: ' + e.message); }
}

/** Linha da aba → MensagemAssistente. */
function conversaPublica(c, lancMap) {
  let barras;
  try { barras = c.barras ? JSON.parse(c.barras) : undefined; } catch (e) { barras = undefined; }
  return semUndefined({ id: c.id, papel: c.papel, texto: c.texto, data: c.data, barras, lancamento: c.lancamento_id && lancMap && lancMap[c.lancamento_id] ? lancamentoPublico(lancMap[c.lancamento_id]) : undefined, etiqueta: c.etiqueta || undefined });
}

/** listar_conversa: histórico do próprio usuário (mais antigas primeiro). */
function acaoListarConversa(p, ctx) {
  const limite = Math.min(Number(p.limite) || 40, MAX_CONVERSA_POR_USUARIO);
  const minhas = lerAba('Conversas').filter((c) => c.usuario_id === ctx.uid).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)).slice(-limite);
  const lancMap = indexarPorId(lerAba('Lancamentos'));
  return minhas.map((c) => conversaPublica(c, lancMap));
}

// ---------- Sugestões de pergunta ----------

/** Chips de perguntas para o momento (função pura). */
function sugestoesAssistente(d, visao, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const despesas = despesasConfirmadas(d);
  const sugestoes = [];
  // Categoria variável que mais subiu em relação à média.
  const subiu = d.categorias.filter((c) => c.tipo_id === TIPO_VARIAVEIS && ehDespesaReal(c)).map((c) => ({ c, dif: totalCategoriaNoMes(despesas, c.id, comp) - mediaCategoria3m(despesas, c.id, comp), media: mediaCategoria3m(despesas, c.id, comp) })).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO && x.dif > 0).sort((a, b) => b.dif - a.dif)[0];
  sugestoes.push('Quanto gastamos com ' + (subiu ? subiu.c.nome.toLowerCase() : 'delivery') + ' este mês?');
  sugestoes.push('Onde podemos economizar?');
  if (d.lancamentos.some((l) => CATEGORIAS_ASSINATURA.indexOf(l.categoria_id) >= 0)) sugestoes.push('Quais assinaturas temos?');
  sugestoes.push('Como fechamos ' + nomeMes(somarMeses(comp, -1)) + '?');
  if (calcularProximasSaidas(d, 7, h).length) sugestoes.push('Contas que vencem esta semana');
  const proj = d.projetos.filter((p) => p.status === 'ativo').sort((a, b) => a.prioridade - b.prioridade)[0];
  if (proj) sugestoes.push('Dá para fechar ' + (/^(a |o )/i.test(proj.nome) ? proj.nome.toLowerCase() : 'o projeto ' + proj.nome) + '?');
  return sugestoes.slice(0, 6);
}

function acaoAssistenteSugestoes(p, ctx) {
  return sugestoesAssistente(carregarDados(), visaoDe(ctx));
}
