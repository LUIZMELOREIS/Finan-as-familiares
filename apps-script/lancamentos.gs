/**
 * lancamentos.gs — Lançamentos, resumo do mês, painel, orçamento, categorias/grupos,
 * previstos das contas fixas, mesada, exportação e log.
 *
 * Regras de negócio (iguais às do modo demonstração em app/src/api/mock.ts):
 *  - competência = mês da data; compra parcelada usa o fechamento do cartão (util.distribuirParcelas);
 *  - soft delete (excluido = S) com desfazer;
 *  - Júnior só vê/edita os próprios lançamentos e nunca categorias sensíveis;
 *  - hash_dedup calculado quando não vem do app.
 */

const FORMAS_PGTO = ['dinheiro', 'pix', 'débito', 'crédito', 'boleto'];

// ---------- Bootstrap ----------

/** bootstrap: tudo que o app precisa para abrir (uma chamada só). */
function acaoBootstrap(p, ctx) {
  const projetos = lerAba('Projetos');
  const aportes = lerAba('Aportes');
  const pendentes = lerAba('CaixaEntrada').filter((c) => c.status === 'pendente' && (!ctx.ehJunior || c.usuario_id === ctx.uid)).length;
  return {
    config: ctx.config,
    usuario: usuarioPublico(ctx.usuario, true),
    usuarios: lerAba('Usuarios').map((u) => usuarioPublico(u, ctx.ehAdmin || u.id === ctx.uid)),
    grupos: lerAba('Grupos').slice().sort((a, b) => a.ordem - b.ordem),
    categorias: categoriasVisiveis(ctx),
    cartoes: lerAba('Cartoes').map(cartaoPublico),
    contas_fixas: lerAba('ContasFixas'),
    projetos: projetos.map((pr) => comValorAtual(pr, aportes)),
    versiculo_do_dia: versiculoDoDia(),
    pendentes_caixa: pendentes,
  };
}

// ---------- Resumo do mês e painel ----------

/** Monta o ResumoMes de uma competência para o usuário do contexto. */
function calcularResumoMes(ctx, comp) {
  const ls = filtrarSensivel(ctx, lancamentosAtivos()).filter((l) => l.competencia === comp && l.status === 'confirmado');
  const categorias = lerAba('Categorias');
  const catMap = {};
  categorias.forEach((c) => { catMap[c.id] = c; });
  const r = { competencia: comp, entrou: 0, saiu: 0, sobrou: 0, por_grupo: {}, por_categoria: {}, por_usuario: {} };
  lerAba('Grupos').forEach((g) => { r.por_grupo[g.id] = { realizado: 0, orcado: 0 }; });
  lerAba('Orcamento').filter((o) => o.competencia === comp).forEach((o) => {
    const c = catMap[o.categoria_id];
    if (ctx.ehJunior && c && c.sensivel && !juniorVeSensivel(ctx)) return;
    r.por_categoria[o.categoria_id] = { realizado: 0, orcado: o.valor_planejado };
    if (c && r.por_grupo[c.grupo_id]) r.por_grupo[c.grupo_id].orcado += o.valor_planejado;
  });
  ls.forEach((l) => {
    const c = catMap[l.categoria_id];
    if (l.tipo === 'receita') r.entrou += l.valor; else r.saiu += l.valor;
    if (c) {
      r.por_grupo[c.grupo_id] = r.por_grupo[c.grupo_id] || { realizado: 0, orcado: 0 };
      r.por_grupo[c.grupo_id].realizado += l.valor;
      r.por_categoria[c.id] = r.por_categoria[c.id] || { realizado: 0, orcado: 0 };
      r.por_categoria[c.id].realizado += l.valor;
    }
    if (l.tipo === 'despesa') r.por_usuario[l.usuario_id] = (r.por_usuario[l.usuario_id] || 0) + l.valor;
  });
  r.entrou = arredondar(r.entrou); r.saiu = arredondar(r.saiu); r.sobrou = arredondar(r.entrou - r.saiu);
  return r;
}

function acaoResumoMes(p, ctx) {
  return calcularResumoMes(ctx, String(p.competencia || competenciaDe()));
}

/** painel (Adulto): 12 meses de um ano. */
function acaoPainel(p, ctx) {
  const ano = Number(p.ano) || new Date().getFullYear();
  const filtro = p.usuario_id_filtro ? String(p.usuario_id_filtro) : '';
  const catMap = {};
  lerAba('Categorias').forEach((c) => { catMap[c.id] = c; });
  const todos = filtrarSensivel(ctx, lancamentosAtivos()).filter((l) => l.status === 'confirmado' && (!filtro || l.usuario_id === filtro));
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    const item = { competencia: comp, saldo: 0, receitas: 0, despesas: 0, salarios: 0, outras_receitas: 0, por_grupo: {}, por_categoria: {}, por_usuario: {} };
    todos.filter((l) => l.competencia === comp).forEach((l) => {
      const c = catMap[l.categoria_id];
      if (l.tipo === 'receita') {
        item.receitas += l.valor;
        if (c && c.subgrupo === 'Salários') item.salarios += l.valor; else item.outras_receitas += l.valor;
      } else {
        item.despesas += l.valor;
        if (c) {
          item.por_grupo[c.grupo_id] = (item.por_grupo[c.grupo_id] || 0) + l.valor;
          item.por_categoria[c.id] = (item.por_categoria[c.id] || 0) + l.valor;
        }
        item.por_usuario[l.usuario_id] = (item.por_usuario[l.usuario_id] || 0) + l.valor;
      }
    });
    item.saldo = arredondar(item.receitas - item.despesas);
    meses.push(item);
  }
  const compAtual = competenciaDe();
  const orcado = {};
  lerAba('Orcamento').filter((o) => o.competencia === compAtual).forEach((o) => { orcado[o.categoria_id] = o.valor_planejado; });
  const projetos = lerAba('Projetos');
  const aportes = lerAba('Aportes');
  const poupanca = [];
  let acumulado = projetos.reduce((s, pr) => s + pr.valor_inicial, 0);
  for (let m = 1; m <= 12; m++) {
    const comp = ano + '-' + zeros(m);
    acumulado += aportes.filter((a) => String(a.data).slice(0, 7) === comp).reduce((s, a) => s + a.valor, 0);
    poupanca.push({ competencia: comp, total: arredondar(acumulado) });
  }
  return { ano, meses, orcado_por_categoria: orcado, poupanca_projetos: poupanca };
}

// ---------- Lançamentos ----------

/** listar_lancamentos: filtros opcionais; Júnior só vê os próprios e os aportes nos sonhos. */
function acaoListarLancamentos(p, ctx) {
  let ls = filtrarSensivel(ctx, lancamentosAtivos());
  if (ctx.ehJunior) ls = ls.filter((l) => l.usuario_id === ctx.uid || l.categoria_id === 'c_aporte_sonho');
  if (p.competencia) ls = ls.filter((l) => l.competencia === p.competencia);
  if (p.categoria_id) ls = ls.filter((l) => l.categoria_id === p.categoria_id);
  if (p.grupo_id) {
    const ids = lerAba('Categorias').filter((c) => c.grupo_id === p.grupo_id).map((c) => c.id);
    ls = ls.filter((l) => ids.indexOf(l.categoria_id) >= 0);
  }
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
  if (ctx.ehJunior && categoria.sensivel && !juniorVeSensivel(ctx)) throw new ErroUsuario('Sem permissão');
  const cartao = l.cartao_id ? buscarPorId('Cartoes', l.cartao_id) : null;
  const usuarioId = ctx.ehJunior ? ctx.uid : (l.usuario_id || ctx.uid);
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

/** salvar_lancamento: novo (com parcelas opcionais) ou edição. Devolve a lista criada/atualizada. */
function acaoSalvarLancamento(p, ctx) {
  const l = p.lancamento;
  if (!l || typeof l !== 'object') throw new ErroUsuario('Lançamento não informado.');
  const existente = l.id ? buscarPorId('Lancamentos', l.id) : null;
  if (l.id && !existente) throw new ErroUsuario('Lançamento não encontrado');
  if (existente && ctx.ehJunior && existente.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');

  const novo = prepararLancamento(l, ctx);
  const parcelas = Number(p.parcelas || 0);
  let lista;
  if (existente) {
    lista = [atualizarPorId('Lancamentos', existente.id, Object.assign(novo, { criado_em: existente.criado_em || novo.criado_em }))];
  } else {
    const cartao = novo.cartao_id ? buscarPorId('Cartoes', novo.cartao_id) : null;
    const criar = parcelas > 1 ? distribuirParcelas(novo, parcelas, cartao) : [novo];
    lista = inserirLinhas('Lancamentos', criar);
    // Aporte em sonho lançado direto pela grade de categorias.
    if (novo.projeto_id) {
      inserirLinhas('Aportes', criar.map((c) => ({ id: gerarId('a'), projeto_id: c.projeto_id, data: c.data, valor: c.valor, usuario_id: c.usuario_id, observacao: c.descricao })));
      verificarMetaProjeto(novo.projeto_id);
    }
  }
  return lista.map(lancamentoPublico);
}

/** excluir_lancamento: soft delete. Júnior só os próprios. */
function acaoExcluirLancamento(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehJunior && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  atualizarPorId('Lancamentos', l.id, { excluido: true, editado_por: ctx.uid });
  return { id: l.id };
}

/** desfazer_exclusao: volta o lançamento. */
function acaoDesfazerExclusao(p, ctx) {
  const l = buscarPorId('Lancamentos', String(p.id || ''));
  if (!l) throw new ErroUsuario('Lançamento não encontrado');
  if (ctx.ehJunior && l.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  return lancamentoPublico(atualizarPorId('Lancamentos', l.id, { excluido: false, editado_por: ctx.uid }));
}

// ---------- Categorias e grupos ----------

function acaoListarCategorias(p, ctx) {
  return lerAba('Categorias').filter((c) => juniorVeSensivel(ctx) || !c.sensivel);
}

function acaoSalvarCategoria(p) {
  const c = p.categoria || {};
  if (!c.nome) throw new ErroUsuario('A categoria precisa de um nome.');
  if (!c.grupo_id || !buscarPorId('Grupos', c.grupo_id)) throw new ErroUsuario('Escolha o grupo da categoria.');
  const nova = {
    id: c.id || gerarId('c'), grupo_id: c.grupo_id, nome: c.nome, icone: c.icone || '🏷️', cor: c.cor || '#A9AAB8',
    tipo: c.tipo === 'receita' ? 'receita' : 'despesa', fixa: paraBooleano(c.fixa), orcamento_mensal: lerValor(c.orcamento_mensal),
    palavras_chave: c.palavras_chave || '', ativa: c.ativa === undefined ? true : paraBooleano(c.ativa),
    subgrupo: c.subgrupo || '', sensivel: paraBooleano(c.sensivel),
  };
  return salvarPorId('Categorias', nova);
}

function acaoSalvarGrupo(p) {
  const g = p.grupo || {};
  if (!g.nome) throw new ErroUsuario('O grupo precisa de um nome.');
  const novo = { id: g.id || gerarId('g'), nome: g.nome, icone: g.icone || '📁', cor: g.cor || '#A9AAB8', ordem: Number(g.ordem) || lerAba('Grupos').length + 1, tipo: g.tipo || 'despesa' };
  return salvarPorId('Grupos', novo);
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
 */
function gerarPrevistosDoMes(competencia) {
  // Quando roda pelo gatilho, o 1º argumento é o objeto do evento — por isso a checagem do formato.
  const comp = typeof competencia === 'string' && /^\d{4}-\d{2}$/.test(competencia) ? competencia : competenciaDe();
  const existentes = {};
  lerAba('Lancamentos').forEach((l) => { if (l.hash_dedup) existentes[l.hash_dedup] = true; });
  const admin = lerAba('Usuarios').find((u) => u.perfil === 'Administrador' && u.ativo);
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
  console.log('gerarPrevistosDoMes: ' + novos.length + ' previsto(s) criado(s) para ' + comp);
  return novos.length;
}

// ---------- Mesada ----------

/** mesada: mesada do mês, quanto gastou, saldo e cofrinho (soma dos aportes do membro). */
function acaoMesada(p, ctx) {
  const alvoId = String(p.usuario_id || ctx.uid);
  if (ctx.ehJunior && alvoId !== ctx.uid) throw new ErroUsuario('Sem permissão');
  const alvo = buscarPorId('Usuarios', alvoId);
  if (!alvo) throw new ErroUsuario('Usuário não encontrado');
  const comp = String(p.competencia || competenciaDe());
  const gasto = lancamentosAtivos().filter((l) => l.usuario_id === alvo.id && l.competencia === comp && l.tipo === 'despesa' && l.categoria_id !== 'c_aporte_sonho').reduce((s, l) => s + l.valor, 0);
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
    const csv = '﻿' + linhas.map((ln) => ln.map((c) => {
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
