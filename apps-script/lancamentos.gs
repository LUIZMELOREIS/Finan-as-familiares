/**
 * lancamentos.gs — Lançamentos, resumo do mês, painel, orçamento, cardápio (tipos/grupos/categorias),
 * regras de loja, previstos das contas fixas, mesada, exportação e log.
 *
 * Regras de negócio (iguais às do modo demonstração em app/src/api/mock.ts):
 *  - competência = mês da data; compra parcelada usa o fechamento do cartão (util.distribuirParcelas);
 *  - soft delete (excluido = S) com desfazer;
 *  - Dependente só vê/edita os próprios lançamentos e nunca categorias sensíveis;
 *  - aportes em projetos (c_aporte_projeto) NÃO contam como despesa (ehDespesaReal);
 *  - hash_dedup calculado quando não vem do app;
 *  - classificação aprende: `aprender_loja` grava a loja → categoria em RegrasLoja.
 *
 * As funções calcularResumoMes/calcularPainel são puras (recebem os dados já lidos) para poderem
 * ser testadas fora do Apps Script.
 */

const FORMAS_PGTO = ['dinheiro', 'pix', 'débito', 'crédito', 'boleto'];

// ---------- Leitura agrupada dos dados ----------

/** Tipos (aba Tipos; se a planilha ainda não tiver a aba preenchida, usa os dados iniciais). */
function lerTipos() {
  const lista = lerAba('Tipos');
  return (lista.length ? lista : dadosIniciaisTipos()).slice().sort((a, b) => a.ordem - b.ordem);
}

/**
 * Lê tudo o que as regras de negócio precisam, de uma vez (todas as abas são cacheadas).
 * O objeto devolvido é o "banco" que as funções puras recebem.
 */
function carregarDados() {
  return {
    config: lerConfig(),
    usuarios: lerAba('Usuarios'),
    tipos: lerTipos(),
    grupos: lerAba('Grupos'),
    categorias: lerAba('Categorias'),
    regras_loja: lerAba('RegrasLoja'),
    lancamentos: lancamentosAtivos(),
    contas_fixas: lerAba('ContasFixas'),
    contas_a_pagar: lerAba('ContasAPagar'),
    cartoes: lerAba('Cartoes'),
    caixa_entrada: lerAba('CaixaEntrada'),
    orcamento: lerAba('Orcamento'),
    projetos: lerAba('Projetos'),
    aportes: lerAba('Aportes'),
    decisoes: lerAba('Decisoes'),
    votos: lerAba('Votos'),
    alertas: lerAba('Alertas'),
    avisos: lerAba('Avisos'),
  };
}

/** Mapa id → objeto. */
function indexarPorId(lista) {
  const m = {};
  (lista || []).forEach((x) => { m[x.id] = x; });
  return m;
}

/** Opções de visibilidade derivadas do contexto (para as funções puras). */
function visaoDe(ctx) {
  return { ver_sensivel: dependenteVeSensivel(ctx), uid: ctx.uid, dependente: !!ctx.ehDependente };
}

/** Lançamentos confirmados visíveis conforme a visão (filtra sensíveis). Função pura. */
function lancamentosVisiveis(d, visao) {
  let ls = d.lancamentos.filter((l) => !l.excluido);
  if (!visao || visao.ver_sensivel !== false) return ls;
  const sensiveis = d.categorias.filter((c) => c.sensivel).map((c) => c.id);
  return ls.filter((l) => sensiveis.indexOf(l.categoria_id) < 0);
}

// ---------- Bootstrap ----------

/** bootstrap: tudo que o app precisa para abrir (uma chamada só). */
function acaoBootstrap(p, ctx) {
  const d = carregarDados();
  const pendentes = d.caixa_entrada.filter((c) => c.status === 'pendente' && (!ctx.ehDependente || c.usuario_id === ctx.uid)).length;
  return {
    config: ctx.config,
    usuario: usuarioPublico(ctx.usuario, true),
    usuarios: d.usuarios.map((u) => usuarioPublico(u, ctx.ehAdmin || u.id === ctx.uid)),
    tipos: d.tipos,
    grupos: d.grupos.filter((g) => g.ativo !== false).slice().sort((a, b) => a.ordem - b.ordem),
    categorias: categoriasVisiveis(ctx),
    regras_loja: d.regras_loja,
    cartoes: d.cartoes.map(cartaoPublico),
    contas_fixas: d.contas_fixas,
    projetos: d.projetos.map((pr) => comProjetoCalculado(d, pr)),
    versiculo_do_dia: versiculoDoDia(),
    pendentes_caixa: pendentes,
  };
}

// ---------- Resumo do mês ----------

/**
 * ResumoMes de uma competência (função pura).
 * @param d dados (carregarDados)
 * @param visao { ver_sensivel, uid, dependente }
 * @param comp "AAAA-MM"
 * @param filtroUsuario usuario_id para filtrar (opcional)
 */
function calcularResumoMes(d, visao, comp, filtroUsuario) {
  let ls = lancamentosVisiveis(d, visao).filter((l) => l.competencia === comp && l.status === 'confirmado');
  if (filtroUsuario) ls = ls.filter((l) => l.usuario_id === filtroUsuario);
  const catMap = indexarPorId(d.categorias);
  const r = { competencia: comp, entrou: 0, saiu: 0, sobrou: 0, por_tipo: {}, projetos: { guardado_total: 0, percentual_medio: 0, ativos: 0 }, por_grupo: {}, por_categoria: {}, por_usuario: {} };
  d.tipos.forEach((t) => { r.por_tipo[t.id] = { realizado: 0, orcado: 0 }; });
  d.grupos.forEach((g) => { r.por_grupo[g.id] = { realizado: 0, orcado: 0 }; });
  const garantirTipo = (id) => { if (id && !r.por_tipo[id]) r.por_tipo[id] = { realizado: 0, orcado: 0 }; };
  const garantirGrupo = (id) => { if (id && !r.por_grupo[id]) r.por_grupo[id] = { realizado: 0, orcado: 0 }; };

  d.orcamento.filter((o) => o.competencia === comp).forEach((o) => {
    const c = catMap[o.categoria_id];
    if (c && c.sensivel && visao && visao.ver_sensivel === false) return;
    r.por_categoria[o.categoria_id] = { realizado: 0, orcado: o.valor_planejado };
    if (c) {
      garantirGrupo(c.grupo_id); garantirTipo(c.tipo_id);
      if (c.grupo_id) r.por_grupo[c.grupo_id].orcado += o.valor_planejado;
      if (c.tipo_id) r.por_tipo[c.tipo_id].orcado += o.valor_planejado;
    }
  });
  // Receita prevista = o que foi planejado no Orçamento para as categorias de receita (salário etc.);
  // sem planejamento, receitas confirmadas do mês anterior (ou média dos 3 anteriores).
  const todas = lancamentosVisiveis(d, visao).filter((l) => l.tipo === 'receita' && l.status === 'confirmado');
  const recAnt = somar(todas.filter((l) => l.competencia === somarMeses(comp, -1)), (l) => l.valor);
  const rec3 = media([1, 2, 3].map((k) => somar(todas.filter((l) => l.competencia === somarMeses(comp, -k)), (l) => l.valor)));
  garantirTipo(TIPO_RECEITAS);
  const receitaPlanejada = r.por_tipo[TIPO_RECEITAS].orcado;
  r.por_tipo[TIPO_RECEITAS].orcado = receitaPlanejada > 0 ? arredondar(receitaPlanejada) : arredondar(recAnt || rec3);

  ls.forEach((l) => {
    const c = catMap[l.categoria_id];
    if (!c) return;
    if (l.tipo === 'receita') r.entrou += l.valor;
    else if (ehDespesaReal(c)) r.saiu += l.valor;
    garantirTipo(c.tipo_id); garantirGrupo(c.grupo_id);
    if (c.tipo_id) r.por_tipo[c.tipo_id].realizado += l.valor;
    if (c.grupo_id) r.por_grupo[c.grupo_id].realizado += l.valor; // categoria sem grupo (planilha editada à mão) não derruba o resumo
    r.por_categoria[c.id] = r.por_categoria[c.id] || { realizado: 0, orcado: 0 };
    r.por_categoria[c.id].realizado += l.valor;
    if (ehDespesaReal(c)) r.por_usuario[l.usuario_id] = (r.por_usuario[l.usuario_id] || 0) + l.valor;
  });
  r.entrou = arredondar(r.entrou); r.saiu = arredondar(r.saiu); r.sobrou = arredondar(r.entrou - r.saiu);
  Object.keys(r.por_tipo).forEach((k) => { r.por_tipo[k].realizado = arredondar(r.por_tipo[k].realizado); r.por_tipo[k].orcado = arredondar(r.por_tipo[k].orcado); });
  Object.keys(r.por_grupo).forEach((k) => { r.por_grupo[k].realizado = arredondar(r.por_grupo[k].realizado); r.por_grupo[k].orcado = arredondar(r.por_grupo[k].orcado); });
  Object.keys(r.por_categoria).forEach((k) => { r.por_categoria[k].realizado = arredondar(r.por_categoria[k].realizado); });
  Object.keys(r.por_usuario).forEach((k) => { r.por_usuario[k] = arredondar(r.por_usuario[k]); });

  // Card Projetos: total guardado, % médio das metas e quantidade de ativos.
  const ativosP = d.projetos.filter((pr) => pr.status === 'ativo');
  const guardado = somar(d.projetos.filter((pr) => pr.status !== 'pausado'), (pr) => valorAtualProjeto(d, pr));
  r.projetos = {
    guardado_total: arredondar(guardado),
    percentual_medio: ativosP.length ? Math.round(somar(ativosP, (pr) => Math.min(100, (valorAtualProjeto(d, pr) / (pr.meta_valor || 1)) * 100)) / ativosP.length) : 0,
    ativos: ativosP.length,
  };
  r.por_tipo[TIPO_PROJETOS] = { realizado: arredondar(guardado), orcado: 0 };
  return r;
}

function acaoResumoMes(p, ctx) {
  const d = carregarDados();
  return calcularResumoMes(d, visaoDe(ctx), String(p.competencia || competenciaDe()), p.usuario_id_filtro ? String(p.usuario_id_filtro) : '');
}

// ---------- Painel ----------

/**
 * DadosPainel de um ano (função pura). Meses futuros são previstos: receitas = média dos 3 últimos
 * meses reais (salário de dezembro × 1,5 pelo 13º), despesas = orçamento da competência atual.
 */
function calcularPainel(d, visao, ano, filtroUsuario, hoje) {
  const catMap = indexarPorId(d.categorias);
  const compAtual = (hoje || hojeIso()).slice(0, 7);
  const todos = lancamentosVisiveis(d, visao).filter((l) => l.status === 'confirmado' && (!filtroUsuario || l.usuario_id === filtroUsuario));
  const orcAtual = d.orcamento.filter((o) => o.competencia === compAtual);
  const comps3 = [1, 2, 3].map((k) => somarMeses(compAtual, -k));
  const base3 = todos.filter((l) => comps3.indexOf(l.competencia) >= 0);
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    const futuro = comp > compAtual;
    const item = { competencia: comp, saldo: 0, receitas: 0, despesas: 0, salarios: 0, outras_receitas: 0, previsto: futuro, por_tipo: {}, por_grupo_analise: {}, por_grupo: {}, por_categoria: {}, por_usuario: {} };
    if (futuro) {
      item.salarios = Math.round(somar(base3.filter((l) => l.tipo === 'receita' && l.categoria_id === 'c_salario'), (l) => l.valor) / 3);
      item.outras_receitas = Math.round(somar(base3.filter((l) => l.tipo === 'receita' && l.categoria_id !== 'c_salario'), (l) => l.valor) / 3);
      if (m === 12) item.salarios = Math.round(item.salarios * 1.5);
      item.receitas = item.salarios + item.outras_receitas;
      orcAtual.forEach((o) => {
        const c = catMap[o.categoria_id];
        if (!ehDespesaReal(c)) return;
        if (c.sensivel && visao && visao.ver_sensivel === false) return;
        item.despesas += o.valor_planejado;
        item.por_tipo[c.tipo_id] = (item.por_tipo[c.tipo_id] || 0) + o.valor_planejado;
        item.por_grupo_analise[c.grupo_analise] = (item.por_grupo_analise[c.grupo_analise] || 0) + o.valor_planejado;
      });
    } else {
      todos.filter((l) => l.competencia === comp).forEach((l) => {
        const c = catMap[l.categoria_id];
        if (!c) return;
        if (l.tipo === 'receita') {
          item.receitas += l.valor;
          if (c.id === 'c_salario' || c.subgrupo === 'Salários') item.salarios += l.valor; else item.outras_receitas += l.valor;
        } else if (ehDespesaReal(c)) {
          item.despesas += l.valor;
          item.por_tipo[c.tipo_id] = (item.por_tipo[c.tipo_id] || 0) + l.valor;
          item.por_grupo_analise[c.grupo_analise || 'Outros'] = (item.por_grupo_analise[c.grupo_analise || 'Outros'] || 0) + l.valor;
          item.por_grupo[c.grupo_id] = (item.por_grupo[c.grupo_id] || 0) + l.valor;
          item.por_categoria[c.id] = (item.por_categoria[c.id] || 0) + l.valor;
          item.por_usuario[l.usuario_id] = (item.por_usuario[l.usuario_id] || 0) + l.valor;
        }
      });
    }
    ['receitas', 'despesas', 'salarios', 'outras_receitas'].forEach((k) => { item[k] = arredondar(item[k]); });
    ['por_tipo', 'por_grupo_analise', 'por_grupo', 'por_categoria', 'por_usuario'].forEach((k) => Object.keys(item[k]).forEach((id) => { item[k][id] = arredondar(item[k][id]); }));
    item.saldo = arredondar(item.receitas - item.despesas);
    meses.push(item);
  }
  const orcado = {};
  orcAtual.forEach((o) => { orcado[o.categoria_id] = o.valor_planejado; });
  const poupanca = [];
  let acumulado = somar(d.projetos, (pr) => pr.valor_inicial) + somar(d.aportes.filter((a) => String(a.data) < ano + '-01-01'), (a) => a.valor);
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    acumulado += somar(d.aportes.filter((a) => String(a.data).slice(0, 7) === comp), (a) => a.valor);
    poupanca.push({ competencia: comp, total: arredondar(acumulado) });
  }
  return { ano: Number(ano), meses, orcado_por_categoria: orcado, poupanca_projetos: poupanca };
}

/** painel (Adulto): 12 meses de um ano. */
function acaoPainel(p, ctx) {
  const d = carregarDados();
  return calcularPainel(d, visaoDe(ctx), Number(p.ano) || new Date().getFullYear(), p.usuario_id_filtro ? String(p.usuario_id_filtro) : '');
}

// ---------- Lançamentos ----------

/** listar_lancamentos: filtros opcionais; Dependente só vê os próprios e os aportes nos projetos. */
function acaoListarLancamentos(p, ctx) {
  let ls = filtrarSensivel(ctx, lancamentosAtivos());
  if (ctx.ehDependente) ls = ls.filter((l) => l.usuario_id === ctx.uid || l.categoria_id === CATEGORIA_APORTE || l.categoria_id === CATEGORIA_APORTE_ANTIGA);
  const categorias = lerAba('Categorias');
  const porCategorias = (filtro) => { const ids = categorias.filter(filtro).map((c) => c.id); ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0); };
  if (p.competencia) ls = ls.filter((l) => l.competencia === p.competencia);
  if (p.categoria_id) ls = ls.filter((l) => l.categoria_id === p.categoria_id);
  if (p.grupo_id) porCategorias((c) => c.grupo_id === p.grupo_id);
  if (p.tipo_id) porCategorias((c) => c.tipo_id === p.tipo_id);
  if (p.grupo_analise) porCategorias((c) => c.grupo_analise === p.grupo_analise);
  if (p.usuario_id_filtro) ls = ls.filter((l) => l.usuario_id === p.usuario_id_filtro);
  if (p.status) ls = ls.filter((l) => l.status === p.status);
  return ls.slice().sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).map(lancamentoPublico);
}

/** Remove o `_linha` e normaliza tipos para devolver ao app. */
function lancamentoPublico(l) {
  const o = Object.assign({}, l);
  o.valor = arredondar(o.valor);
  o.excluido = !!o.excluido;
  return o;
}

/** Valida e completa um lançamento vindo do app. */
function prepararLancamento(l, ctx) {
  const data = normalizarDataIso(l.data || hojeIso());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroUsuario('Data inválida.');
  const valor = lerValor(l.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe um valor maior que zero.');
  if (!l.categoria_id) throw new ErroUsuario('Escolha uma categoria.');
  const categoria = buscarPorId('Categorias', l.categoria_id);
  if (!categoria) throw new ErroUsuario('Categoria não encontrada.');
  if (ctx.ehDependente && categoria.sensivel && !dependenteVeSensivel(ctx)) throw new ErroUsuario('Sem permissão');
  const cartao = l.cartao_id ? buscarPorId('Cartoes', l.cartao_id) : null;
  const usuarioId = ctx.ehDependente ? ctx.uid : (l.usuario_id || ctx.uid);
  return semUndefined({
    id: l.id || gerarId('l'),
    data,
    competencia: l.competencia || competenciaDe(data),
    tipo: l.tipo === 'receita' ? 'receita' : (l.tipo || categoria.tipo || 'despesa'),
    valor,
    categoria_id: l.categoria_id,
    descricao: String(l.descricao || categoria.nome || '').trim(),
    estabelecimento: String(l.estabelecimento || '').trim(),
    forma_pgto: FORMAS_PGTO.indexOf(l.forma_pgto) >= 0 ? l.forma_pgto : 'pix',
    cartao_id: l.cartao_id || '',
    parcela: l.parcela || '',
    usuario_id: usuarioId,
    origem: l.origem || 'manual',
    anexo_url: l.anexo_url || '',
    status: l.status === 'a_confirmar' ? 'a_confirmar' : 'confirmado',
    hash_dedup: l.hash_dedup || hashDedup(valor, data, cartao ? cartao.final : '', l.estabelecimento || l.descricao || ''),
    criado_em: l.criado_em || agoraIso(),
    editado_por: l.id ? ctx.uid : '',
    excluido: false,
    projeto_id: l.projeto_id || '',
  });
}

/** salvar_lancamento: novo (com parcelas opcionais) ou edição. `aprender_loja` grava a regra da loja. */
function acaoSalvarLancamento(p, ctx) {
  const l = p.lancamento;
  if (!l || typeof l !== 'object') throw new ErroUsuario('Lançamento não informado.');
  const existente = l.id ? buscarPorId('Lancamentos', l.id) : null;
  if (l.id && !existente) throw new ErroUsuario('Lançamento não encontrado');
  if (existente && ctx.ehDependente && existente.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');

  const novo = prepararLancamento(l, ctx);
  const parcelas = Number(p.parcelas || 0);
  let lista;
  if (existente) {
    lista = [atualizarPorId('Lancamentos', existente.id, Object.assign(novo, { criado_em: existente.criado_em || novo.criado_em }))];
  } else {
    const cartao = novo.cartao_id ? buscarPorId('Cartoes', novo.cartao_id) : null;
    const criar = parcelas > 1 ? distribuirParcelas(novo, parcelas, cartao) : [novo];
    lista = inserirLinhas('Lancamentos', criar);
    // Aporte em projeto lançado direto pelo cardápio/assistente.
    if (novo.projeto_id) {
      inserirLinhas('Aportes', criar.map((c) => ({ id: gerarId('a'), projeto_id: c.projeto_id, data: c.data, valor: c.valor, usuario_id: c.usuario_id, observacao: c.descricao })));
      verificarMetaProjeto(novo.projeto_id);
    }
  }
  if (paraBooleano(p.aprender_loja) && novo.estabelecimento) {
    try { aprenderLoja(novo.estabelecimento, novo.categoria_id, ctx.uid); } catch (e) { console.warn('Não gravei a regra da loja: ' + e.message); }
  }
  return lista.map(lancamentoPublico);
}

/** excluir_lancamento: soft delete. Dependente só os próprios. */
function acaoExcluirLancamento(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehDependente && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  atualizarPorId('Lancamentos', l.id, { excluido: true, editado_por: ctx.uid });
  return { id: l.id };
}

/** desfazer_exclusao: volta o lançamento. */
function acaoDesfazerExclusao(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehDependente && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  return lancamentoPublico(atualizarPorId('Lancamentos', l.id, { excluido: false, editado_por: ctx.uid }));
}

// ---------- Cardápio: categorias e grupos ----------

function acaoListarCategorias(p, ctx) {
  return lerAba('Categorias').filter((c) => dependenteVeSensivel(ctx) || !c.sensivel);
}

/** salvar_categoria (Administrador): herda tipo_id, cor e grupo_analise do grupo; ícone é nome Lucide. */
function acaoSalvarCategoria(p) {
  const c = p.categoria || {};
  if (!c.nome) throw new ErroUsuario('A categoria precisa de um nome.');
  const grupo = c.grupo_id ? buscarPorId('Grupos', c.grupo_id) : null;
  if (!grupo) throw new ErroUsuario('Escolha o grupo da categoria.');
  const existente = c.id ? buscarPorId('Categorias', c.id) : null;
  const nova = {
    id: c.id || gerarId('c'), tipo_id: grupo.tipo_id || c.tipo_id || TIPO_VARIAVEIS, grupo_id: grupo.id, nome: String(c.nome).trim(),
    icone: String(c.icone || 'tag').trim().toLowerCase(), cor: c.cor || grupo.cor || 'indigo',
    tipo: (grupo.tipo_id || c.tipo_id) === TIPO_RECEITAS ? 'receita' : 'despesa', fixa: paraBooleano(c.fixa), orcamento_mensal: lerValor(c.orcamento_mensal),
    palavras_chave: String(c.palavras_chave || ''), grupo_analise: c.grupo_analise || grupo.grupo_analise || 'Outros',
    sensivel: c.sensivel === undefined ? !!(existente && existente.sensivel) : paraBooleano(c.sensivel),
    oculta_cardapio: c.oculta_cardapio === undefined ? !!(existente && existente.oculta_cardapio) : paraBooleano(c.oculta_cardapio),
    ativa: c.ativa === undefined ? true : paraBooleano(c.ativa),
  };
  return salvarPorId('Categorias', nova);
}

/** salvar_grupo (Administrador): só dentro dos 3 tipos (Receitas, Fixas, Variáveis). */
function acaoSalvarGrupo(p) {
  const g = p.grupo || {};
  if (!g.nome) throw new ErroUsuario('O grupo precisa de um nome.');
  const existente = g.id ? buscarPorId('Grupos', g.id) : null;
  const tipoId = g.tipo_id || (existente ? existente.tipo_id : '');
  if (TIPOS_COM_GRUPOS.indexOf(tipoId) < 0) throw new ErroUsuario('Novos grupos só dentro dos 3 tipos.');
  const novo = {
    id: g.id || gerarId('g'), tipo_id: tipoId, nome: String(g.nome).trim(), cor: g.cor || (existente ? existente.cor : 'indigo'),
    grupo_analise: g.grupo_analise || (existente ? existente.grupo_analise : 'Outros'),
    ordem: Number(g.ordem) || (existente ? existente.ordem : lerAba('Grupos').length + 1),
    ativo: g.ativo === undefined ? true : paraBooleano(g.ativo),
  };
  return salvarPorId('Grupos', novo);
}

// ---------- Regras de loja (classificação que aprende) ----------

/** Procura a regra de uma loja (função pura): a loja normalizada contém a chave da regra. */
function regraDaLoja(estabelecimento, regras) {
  const chave = normalizar(estabelecimento);
  if (!chave) return null;
  let melhor = null;
  (regras || []).forEach((r) => {
    const k = String(r.loja_normalizada || '');
    if (k && (chave === k || chave.indexOf(k) >= 0) && (!melhor || k.length > melhor.loja_normalizada.length)) melhor = r;
  });
  return melhor;
}

/** Aplica a regra de loja a uma lista de sugestões (função pura): a categoria aprendida vai para o 1º lugar. */
function aplicarRegraLoja(estabelecimento, sugestoes, regras) {
  const r = regraDaLoja(estabelecimento, regras);
  if (!r) return (sugestoes || []).slice();
  return [r.categoria_id].concat((sugestoes || []).filter((id) => id !== r.categoria_id)).slice(0, 6);
}

/** Grava/atualiza a regra "esta loja cai nesta categoria". */
function aprenderLoja(loja, categoriaId, uid) {
  const chave = normalizar(loja);
  if (!chave) throw new ErroUsuario('Loja vazia');
  if (!categoriaId || !buscarPorId('Categorias', categoriaId)) throw new ErroUsuario('Categoria não encontrada.');
  const existente = lerAba('RegrasLoja').find((r) => r.loja_normalizada === chave);
  if (existente) return atualizarPorId('RegrasLoja', existente.id, { categoria_id: categoriaId, acertos: (Number(existente.acertos) || 0) + 1 });
  return inserirLinhas('RegrasLoja', [{ id: gerarId('rl'), loja_normalizada: chave, categoria_id: categoriaId, criado_por: uid || '', criado_em: agoraIso(), acertos: 1 }])[0];
}

function acaoListarRegrasLoja() {
  return lerAba('RegrasLoja');
}

/** salvar_regra_loja: chamado quando o usuário corrige a categoria sugerida. */
function acaoSalvarRegraLoja(p, ctx) {
  return aprenderLoja(String(p.loja || ''), String(p.categoria_id || ''), ctx.uid);
}

// ---------- Orçamento ----------

function acaoListarOrcamento(p) {
  return lerAba('Orcamento').filter((o) => o.competencia === p.competencia).map((o) => ({ competencia: o.competencia, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
}

/** salvar_orcamento: substitui todos os itens da competência. */
function acaoSalvarOrcamento(p) {
  const comp = String(p.competencia || '');
  if (!/^\d{4}-\d{2}$/.test(comp)) throw new ErroUsuario('Competência inválida (use AAAA-MM).');
  const itens = (p.itens || []).map((i) => ({ competencia: comp, categoria_id: i.categoria_id, valor_planejado: lerValor(i.valor_planejado) })).filter((i) => i.categoria_id);
  const outros = lerAba('Orcamento').filter((o) => o.competencia !== comp);
  substituirAba('Orcamento', outros.concat(itens));
  return itens;
}

/** copiar_orcamento: copia os itens de `de` para `para` (substituindo os de `para`). */
function acaoCopiarOrcamento(p) {
  const de = String(p.de || ''), para = String(p.para || '');
  if (!de || !para) throw new ErroUsuario('Informe as competências de origem e destino.');
  const todos = lerAba('Orcamento');
  const copiados = todos.filter((o) => o.competencia === de).map((o) => ({ competencia: para, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
  substituirAba('Orcamento', todos.filter((o) => o.competencia !== para).concat(copiados));
  return copiados;
}

// ---------- Previstos das contas fixas (gatilho diário 06h) ----------

/**
 * Cria, para o mês atual, um lançamento "a_confirmar" por conta fixa ativa, com o valor previsto.
 * Idempotente: usa hash_dedup "previsto_<conta>_<competência>". Quando a conta é paga
 * (marcar_conta_paga), o previsto é marcado como excluído.
 * Também garante o orçamento do mês (copia o anterior ou usa o orcamento_mensal das categorias).
 */
function gerarPrevistosDoMes(competencia) {
  // Quando roda pelo gatilho, o 1º argumento é o objeto do evento — por isso a checagem do formato.
  const comp = typeof competencia === 'string' && /^\d{4}-\d{2}$/.test(competencia) ? competencia : competenciaDe();
  const existentes = {};
  lerAba('Lancamentos').forEach((l) => { if (l.hash_dedup) existentes[l.hash_dedup] = true; });
  const admin = lerAba('Usuarios').find((u) => normalizarPerfil(u.perfil) === 'Administrador' && u.ativo);
  const novos = [];
  lerAba('ContasFixas').filter((cf) => cf.ativa).forEach((cf) => {
    const hash = 'previsto_' + cf.id + '_' + comp;
    if (existentes[hash]) return;
    const dia = Math.min(Number(cf.dia_vencimento) || 10, ultimoDiaDoMes(comp));
    novos.push({
      id: gerarId('l'), data: comp + '-' + zeros(dia), competencia: comp, tipo: 'despesa', valor: cf.valor_previsto,
      categoria_id: cf.categoria_id, descricao: cf.nome + ' (previsto)', estabelecimento: cf.nome, forma_pgto: 'boleto',
      cartao_id: '', parcela: '', usuario_id: admin ? admin.id : '', origem: 'recorrente', anexo_url: '', status: 'a_confirmar',
      hash_dedup: hash, criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
    });
  });
  if (novos.length) inserirLinhas('Lancamentos', novos);
  garantirOrcamentoDoMes(comp);
  console.log('gerarPrevistosDoMes: ' + novos.length + ' previsto(s) criado(s) para ' + comp);
  return novos.length;
}

/** Se a competência não tem orçamento, copia o do mês anterior (ou o orcamento_mensal das categorias). */
function garantirOrcamentoDoMes(comp) {
  const todos = lerAba('Orcamento');
  if (todos.some((o) => o.competencia === comp)) return 0;
  let itens = todos.filter((o) => o.competencia === somarMeses(comp, -1)).map((o) => ({ competencia: comp, categoria_id: o.categoria_id, valor_planejado: o.valor_planejado }));
  if (!itens.length) itens = lerAba('Categorias').filter((c) => c.ativa && c.orcamento_mensal > 0).map((c) => ({ competencia: comp, categoria_id: c.id, valor_planejado: c.orcamento_mensal }));
  if (itens.length) inserirLinhas('Orcamento', itens);
  return itens.length;
}

// ---------- Mesada ----------

/** mesada: mesada do mês, quanto gastou, saldo e cofrinho (soma dos aportes do membro). */
function acaoMesada(p, ctx) {
  const alvoId = String(p.usuario_id || ctx.uid);
  if (ctx.ehDependente && alvoId !== ctx.uid) throw new ErroUsuario('Sem permissão');
  const alvo = buscarPorId('Usuarios', alvoId);
  if (!alvo) throw new ErroUsuario('Usuário não encontrado');
  const comp = String(p.competencia || competenciaDe());
  const gasto = lancamentosAtivos().filter((l) => l.usuario_id === alvo.id && l.competencia === comp && l.tipo === 'despesa' && l.categoria_id !== CATEGORIA_APORTE && l.categoria_id !== CATEGORIA_APORTE_ANTIGA).reduce((s, l) => s + l.valor, 0);
  const cofrinho = lerAba('Aportes').filter((a) => a.usuario_id === alvo.id).reduce((s, a) => s + a.valor, 0);
  const mesada = Number(alvo.mesada_mensal) || 0;
  return { mesada_mensal: mesada, gasto: arredondar(gasto), saldo: arredondar(mesada - gasto), cofrinho: arredondar(cofrinho) };
}

// ---------- Exportar ----------

/** Linhas (array de arrays) para exportação, com nomes legíveis. */
function linhasParaExportar(competencia) {
  const catMap = {}, userMap = {};
  lerAba('Categorias').forEach((c) => { catMap[c.id] = c.nome; });
  lerAba('Usuarios').forEach((u) => { userMap[u.id] = u.apelido; });
  const ls = lancamentosAtivos().filter((l) => !competencia || l.competencia === competencia).sort((a, b) => (a.data < b.data ? -1 : 1));
  const linhas = [['data', 'competencia', 'tipo', 'valor', 'categoria', 'descricao', 'estabelecimento', 'forma_pgto', 'quem', 'origem', 'status', 'parcela']];
  ls.forEach((l) => linhas.push([l.data, l.competencia, l.tipo, l.valor, catMap[l.categoria_id] || l.categoria_id, l.descricao, l.estabelecimento, l.forma_pgto, userMap[l.usuario_id] || l.usuario_id, l.origem, l.status, l.parcela || '']));
  return linhas;
}

/**
 * exportar (Administrador): CSV (separador ";", vírgula decimal, com BOM para o Excel) ou XLSX
 * (planilha temporária exportada pelo Drive). O arquivo fica em Backups/Exportações com link
 * "qualquer pessoa com o link" para o celular conseguir baixar.
 */
function acaoExportar(p) {
  const formato = p.formato === 'xlsx' ? 'xlsx' : 'csv';
  const comp = p.competencia ? String(p.competencia) : '';
  const linhas = linhasParaExportar(comp);
  const nomeBase = 'Lancamentos_' + (comp || 'tudo') + '_' + hojeIso();
  const pasta = pastaPorCaminho('Backups/Exportações');
  let arquivo;
  if (formato === 'csv') {
    const csv = '\uFEFF' + linhas.map((ln) => ln.map((c) => {
      if (typeof c === 'number') return c.toFixed(2).replace('.', ',');
      const s = String(c === null || c === undefined ? '' : c);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    arquivo = pasta.createFile(nomeBase + '.csv', csv, 'text/csv');
  } else {
    const temp = SpreadsheetApp.create(nomeBase);
    const aba = temp.getSheets()[0];
    aba.setName('Lançamentos');
    aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
    aba.setFrozenRows(1);
    SpreadsheetApp.flush();
    const url = 'https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx';
    const resposta = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resposta.getResponseCode() !== 200) throw new ErroUsuario('Não consegui gerar o arquivo Excel agora. Tente o CSV.');
    arquivo = pasta.createFile(resposta.getBlob().setName(nomeBase + '.xlsx'));
    DriveApp.getFileById(temp.getId()).setTrashed(true);
  }
  compartilharComLink(arquivo);
  return { url: urlDownload(arquivo.getId()) };
}

// ---------- Log ----------

/** log (Administrador): últimos registros, do mais novo para o mais antigo. */
function acaoLog(p) {
  const limite = Math.min(Number(p.limite) || 100, 1000);
  const aba = obterAba('Log');
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  const inicio = Math.max(2, ultima - limite + 1);
  const valores = aba.getRange(inicio, 1, ultima - inicio + 1, 4).getValues();
  return valores.map((v) => ({ data: ehData(v[0]) ? dataHoraParaIso(v[0]) : String(v[0]), usuario_id: String(v[1]), acao: String(v[2]), detalhe: String(v[3]) })).reverse();
}
