/**
 * familia.gs — Projetos (metas e aportes), decisões e votos, reunião mensal e relatório do mês,
 * patrimônio manual, versículo do dia, configuração e arquivos de identidade (foto de capa, brasão).
 *
 * Campos calculados dos projetos (iguais ao modo demonstração):
 *  - valor_atual = valor_inicial + soma dos aportes;
 *  - necessario_mes = quanto falta ÷ meses até a data-alvo;
 *  - media_3m = média dos aportes dos 3 meses anteriores;
 *  - situacao: no_ritmo (média ≥ 95% do necessário) | atrasado | votacao | concluido | pausado;
 *  - atraso = (necessário − média) × 3; votos_sim / votos_total / aguardando da decisão vinculada.
 */

// ---------- Projetos ----------

/** valor_atual = valor_inicial + soma dos aportes (função pura sobre os dados). */
function valorAtualProjeto(d, projeto) {
  return arredondar((Number(projeto.valor_inicial) || 0) + somar(d.aportes.filter((a) => a.projeto_id === projeto.id), (a) => a.valor));
}

/** Quanto guardar por mês para fechar a meta na data-alvo (função pura). */
function necessarioPorMes(d, projeto, hoje) {
  const falta = Math.max(0, (Number(projeto.meta_valor) || 0) - valorAtualProjeto(d, projeto));
  const h = String(hoje || hojeIso());
  const alvo = String(projeto.data_alvo || '').slice(0, 7);
  const partesH = h.split('-').map(Number), partesA = alvo.split('-').map(Number);
  const meses = partesA[0] && partesA[1] ? Math.max(1, (partesA[0] - partesH[0]) * 12 + (partesA[1] - partesH[1])) : 12;
  return Math.round(falta / meses);
}

/** Média dos aportes dos 3 meses anteriores ao atual (função pura). */
function mediaAportes3m(d, projeto, hoje) {
  const comp = String(hoje || hojeIso()).slice(0, 7);
  const comps = [1, 2, 3].map((k) => somarMeses(comp, -k));
  return somar(d.aportes.filter((a) => a.projeto_id === projeto.id && comps.indexOf(String(a.data).slice(0, 7)) >= 0), (a) => a.valor) / 3;
}

/** Projeto com todos os campos calculados (função pura). */
function comProjetoCalculado(d, projeto, hoje) {
  const necessario = necessarioPorMes(d, projeto, hoje);
  const med = mediaAportes3m(d, projeto, hoje);
  const atraso = Math.max(0, Math.round((necessario - med) * 3));
  const situacao = projeto.status === 'votação' ? 'votacao' : projeto.status === 'concluído' ? 'concluido' : projeto.status === 'pausado' ? 'pausado' : (med >= necessario * 0.95 ? 'no_ritmo' : 'atrasado');
  const decisao = (d.decisoes || []).find((x) => x.projeto_id === projeto.id);
  const vs = decisao ? (d.votos || []).filter((v) => v.decisao_id === decisao.id) : [];
  const votantes = (d.usuarios || []).filter((u) => u.ativo).length;
  return Object.assign({}, projeto, {
    valor_atual: valorAtualProjeto(d, projeto), necessario_mes: necessario, media_3m: Math.round(med), situacao, atraso,
    votos_sim: vs.filter((v) => v.voto === 'sim').length, votos_total: vs.length, aguardando: Math.max(0, votantes - vs.length),
  });
}

/** Compatibilidade com a v1: só o valor_atual. */
function comValorAtual(projeto, aportes) {
  return Object.assign({}, projeto, { valor_atual: valorAtualProjeto({ aportes: aportes || lerAba('Aportes') }, projeto) });
}

function acaoListarProjetos() {
  const d = carregarDados();
  return d.projetos.map((p) => comProjetoCalculado(d, p)).sort((a, b) => a.prioridade - b.prioridade);
}

/** salvar_projeto: Dependente só cria/edita o próprio projeto; Adulto/Administrador qualquer um. */
function acaoSalvarProjeto(p, ctx) {
  const pr = p.projeto || {};
  if (!pr.nome) throw new ErroUsuario('Dê um nome ao projeto.');
  const meta = lerValor(pr.meta_valor);
  if (!(meta > 0)) throw new ErroUsuario('Informe o valor da meta.');
  const existente = pr.id ? buscarPorId('Projetos', pr.id) : null;
  if (pr.id && !existente) throw new ErroUsuario('Projeto não encontrado');
  if (ctx.ehDependente) {
    if (existente && existente.criado_por !== ctx.uid) throw new ErroUsuario('Sem permissão');
    pr.criado_por = ctx.uid;
    if (!existente) pr.prioridade = Math.max(Number(pr.prioridade) || 0, 4);
  }
  const novo = {
    id: pr.id || gerarId('p'), nome: String(pr.nome).trim(), icone: pr.icone || 'target', foto_url: pr.foto_url || '', meta_valor: meta,
    data_alvo: normalizarDataIso(pr.data_alvo) || somarMeses(competenciaDe(), 12) + '-01', valor_inicial: lerValor(pr.valor_inicial),
    prioridade: Number(pr.prioridade) || (existente ? existente.prioridade : lerAba('Projetos').length + 1),
    status: ['votação', 'ativo', 'concluído', 'pausado'].indexOf(pr.status) >= 0 ? pr.status : (existente ? existente.status : 'ativo'),
    versiculo: pr.versiculo || 'Lucas 14:28', criado_por: existente ? existente.criado_por : (pr.criado_por || ctx.uid),
    criado_em: existente ? existente.criado_em : (pr.criado_em || agoraIso()),
  };
  const salvo = salvarPorId('Projetos', novo);
  return comProjetoCalculado(carregarDados(), salvo);
}

/** Marca o projeto como concluído quando o valor atual bate a meta. */
function verificarMetaProjeto(projetoId) {
  const pr = buscarPorId('Projetos', projetoId);
  if (!pr) return null;
  const atual = comValorAtual(pr);
  if (atual.valor_atual >= pr.meta_valor && pr.status !== 'concluído') atualizarPorId('Projetos', pr.id, { status: 'concluído' });
  return atual;
}

/** aportar: registra o aporte e o lançamento em c_aporte_projeto (que não conta como despesa). */
function acaoAportar(p, ctx) {
  const pr = buscarPorId('Projetos', String(p.projeto_id || ''));
  if (!pr) throw new ErroUsuario('Projeto não encontrado');
  const valor = lerValor(p.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe um valor maior que zero.');
  const hoje = hojeIso();
  const aporte = inserirLinhas('Aportes', [{ id: gerarId('a'), projeto_id: pr.id, data: hoje, valor, usuario_id: ctx.uid, observacao: String(p.observacao || '') }])[0];
  inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data: hoje, competencia: competenciaDe(hoje), tipo: 'despesa', valor, categoria_id: CATEGORIA_APORTE,
    descricao: 'Aporte: ' + pr.nome, estabelecimento: 'Poupança', forma_pgto: 'pix', cartao_id: '', parcela: '', usuario_id: ctx.uid,
    origem: 'manual', anexo_url: '', status: 'confirmado', hash_dedup: 'aporte_' + aporte.id, criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: pr.id,
  }]);
  verificarMetaProjeto(pr.id);
  return aporte;
}

function acaoListarAportes(p) {
  return lerAba('Aportes').filter((a) => a.projeto_id === p.projeto_id).sort((a, b) => (a.data < b.data ? 1 : -1));
}

// ---------- Decisões e votos ----------

function votosDe(decisaoId, votos) {
  return (votos || lerAba('Votos')).filter((v) => v.decisao_id === decisaoId);
}

function acaoListarDecisoes(p) {
  let ds = lerAba('Decisoes');
  if (p.status) ds = ds.filter((d) => d.status === p.status);
  const votos = lerAba('Votos');
  return ds.map((d) => Object.assign({}, d, { votos: votosDe(d.id, votos) })).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
}

function acaoSalvarDecisao(p, ctx) {
  const d = p.decisao || {};
  if (!d.titulo) throw new ErroUsuario('Dê um título à proposta.');
  const existente = d.id ? buscarPorId('Decisoes', d.id) : null;
  if (existente && existente.status !== 'aberta' && !ctx.ehAdmin) throw new ErroUsuario('Esta votação já foi encerrada');
  if (existente && existente.criado_por !== ctx.uid && !ctx.ehAdmin) throw new ErroUsuario('Sem permissão');
  const nova = {
    id: d.id || gerarId('d'), titulo: d.titulo, descricao: d.descricao || '',
    tipo: ['novo projeto', 'gasto grande', 'ajuste de orçamento'].indexOf(d.tipo) >= 0 ? d.tipo : 'gasto grande',
    valor: lerValor(d.valor), criado_por: existente ? existente.criado_por : (d.criado_por || ctx.uid),
    criado_em: existente ? existente.criado_em : (d.criado_em || agoraIso()),
    prazo: normalizarDataIso(d.prazo) || somarDias(hojeIso(), 7),
    status: existente ? (ctx.ehAdmin && d.status ? d.status : existente.status) : 'aberta', projeto_id: d.projeto_id || '',
  };
  const salva = salvarPorId('Decisoes', nova);
  return Object.assign({}, salva, { votos: votosDe(salva.id) });
}

/** votar: um voto por pessoa (o último vale). */
function acaoVotar(p, ctx) {
  const d = buscarPorId('Decisoes', String(p.decisao_id || ''));
  if (!d) throw new ErroUsuario('Decisão não encontrada');
  if (d.status !== 'aberta') throw new ErroUsuario('Esta votação já foi encerrada');
  if (['sim', 'não', 'abster'].indexOf(p.voto) < 0) throw new ErroUsuario('Voto inválido. Use sim, não ou abster.');
  const outros = lerAba('Votos').filter((v) => !(v.decisao_id === d.id && v.usuario_id === ctx.uid));
  outros.push({ decisao_id: d.id, usuario_id: ctx.uid, voto: p.voto, comentario: String(p.comentario || ''), data: agoraIso() });
  substituirAba('Votos', outros);
  return Object.assign({}, d, { votos: votosDe(d.id) });
}

/** encerrar_decisao (Administrador): aplica a regra de votação da Config. */
function acaoEncerrarDecisao(p, ctx) {
  const d = buscarPorId('Decisoes', String(p.decisao_id || ''));
  if (!d) throw new ErroUsuario('Decisão não encontrada');
  const votos = votosDe(d.id);
  const pais = lerAba('Usuarios').filter((u) => normalizarPerfil(u.perfil) === 'Administrador').map((u) => u.id);
  const aprovada = aplicarRegraVotacao(votos, ctx.config.regra_votacao, pais);
  const atualizada = atualizarPorId('Decisoes', d.id, { status: aprovada ? 'aprovada' : 'recusada' });
  if (d.projeto_id && buscarPorId('Projetos', d.projeto_id)) atualizarPorId('Projetos', d.projeto_id, { status: aprovada ? 'ativo' : 'pausado' });
  return Object.assign({}, atualizada, { votos });
}

// ---------- Reunião mensal e relatório do mês ----------

/**
 * Pauta da reunião em markdown (função pura, mesmo texto do modo demonstração).
 * @param d dados; @param visao visão do usuário; @param comp competência; @param versiculo {texto, referencia}
 */
function gerarPautaMarkdown(d, visao, comp, versiculo, titulo) {
  const r = calcularResumoMes(d, visao, comp);
  const ant = calcularResumoMes(d, visao, somarMeses(comp, -1));
  const catMap = indexarPorId(d.categorias);
  const estouradas = Object.keys(r.por_categoria).filter((id) => r.por_categoria[id].orcado && r.por_categoria[id].realizado > r.por_categoria[id].orcado)
    .map((id) => '- ' + (catMap[id] ? catMap[id].nome : id) + ': ' + moeda(r.por_categoria[id].realizado) + ' de ' + moeda(r.por_categoria[id].orcado) + ' planejados');
  const subiram = d.contas_fixas.map((cf) => {
    const a = d.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === comp);
    const pAnt = d.contas_a_pagar.find((c) => c.conta_fixa_id === cf.id && c.competencia === somarMeses(comp, -1));
    if (a && pAnt && pAnt.valor > 0 && a.valor / pAnt.valor > 1.2) return '- ' + cf.nome + ': subiu ' + Math.round((a.valor / pAnt.valor - 1) * 100) + '% (' + moeda(pAnt.valor) + ' → ' + moeda(a.valor) + ')';
    return null;
  }).filter(Boolean);
  const projetos = d.projetos.filter((pr) => pr.status === 'ativo').map((pr) => {
    const pc = comProjetoCalculado(d, pr);
    return '- ' + pr.nome + ': ' + Math.round((pc.valor_atual / (pr.meta_valor || 1)) * 100) + '% (' + moeda(pc.valor_atual) + ' de ' + moeda(pr.meta_valor) + ') — ' + (pc.situacao === 'no_ritmo' ? 'no ritmo' : 'atrasado ' + moeda(pc.atraso));
  });
  const abertas = d.decisoes.filter((x) => x.status === 'aberta').map((x) => '- ' + x.titulo + ' (prazo ' + dataBr(x.prazo) + ')');
  const v = versiculo || { texto: '', referencia: '' };
  return [
    '# ' + (titulo || 'Reunião da família') + ' — ' + nomeCompetencia(comp), '',
    '## 1. Como fechou o mês',
    '- Entrou ' + moeda(r.entrou) + ' · Saiu ' + moeda(r.saiu) + ' · ' + (r.sobrou >= 0 ? 'Sobrou' : 'Faltou') + ' ' + moeda(Math.abs(r.sobrou)),
    '- Mês anterior: ' + (ant.sobrou >= 0 ? 'sobrou' : 'faltou') + ' ' + moeda(Math.abs(ant.sobrou)),
    '', '## 2. O que passou do orçamento'].concat(estouradas.length ? estouradas : ['- Nada passou do orçamento.'],
    ['', '## 3. Contas que subiram'], subiram.length ? subiram : ['- Nenhuma conta subiu mais de 20%.'],
    ['', '## 4. Situação dos projetos'], projetos.length ? projetos : ['- Nenhum projeto ativo.'],
    ['', '## 5. Decisões abertas'], abertas.length ? abertas : ['- Nenhuma.'],
    ['', '## 6. Para refletir', '> "' + v.texto + '" — ' + v.referencia,
     '', '## 7. O que decidimos', '_(preencher)_', '', '## 8. Motivo de gratidão', '_(preencher)_']).join('\n');
}

/** Pauta lendo a planilha (atalho usado pelas ações e rotinas). */
function gerarPauta(ctx, comp, titulo) {
  return gerarPautaMarkdown(carregarDados(), visaoDe(ctx), comp, versiculoDoDia('família'), titulo);
}

/** pauta_reuniao: devolve a reunião já salva da competência ou uma nova com a pauta gerada. */
function acaoPautaReuniao(p, ctx) {
  const comp = String(p.competencia || competenciaDe());
  const existente = lerAba('Reunioes').find((r) => r.competencia === comp);
  if (existente) return existente;
  return { id: gerarId('r'), competencia: comp, data: hojeIso(), pauta: gerarPauta(ctx, comp), decidido: '', oracao_gratidao: '', criado_por: ctx.uid };
}

function acaoSalvarReuniao(p, ctx) {
  const r = p.reuniao || {};
  if (!r.competencia) throw new ErroUsuario('Informe a competência da reunião.');
  const existente = lerAba('Reunioes').find((x) => x.id === r.id || x.competencia === r.competencia);
  const nova = {
    id: existente ? existente.id : (r.id || gerarId('r')), competencia: r.competencia, data: normalizarDataIso(r.data) || hojeIso(),
    pauta: r.pauta || (existente ? existente.pauta : ''), decidido: r.decidido || '', oracao_gratidao: r.oracao_gratidao || '',
    criado_por: existente ? existente.criado_por : (r.criado_por || ctx.uid),
  };
  return salvarPorId('Reunioes', nova);
}

/** listar_reunioes (Adulto): da mais recente para a mais antiga. */
function acaoListarReunioes() {
  return lerAba('Reunioes').slice().sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
}

/**
 * Projeção dos 3 meses seguintes a `comp` (função pura): usa o painel do ano (meses futuros já
 * vêm previstos; meses passados, realizados).
 */
function projetarTresMeses(d, visao, comp, hoje) {
  const cache = {};
  const painelDe = (ano) => { if (!cache[ano]) cache[ano] = calcularPainel(d, visao, ano, '', hoje); return cache[ano]; };
  return [1, 2, 3].map((k) => {
    const c = somarMeses(comp, k);
    const m = painelDe(Number(c.slice(0, 4))).meses.find((x) => x.competencia === c);
    return { competencia: c, receitas: m ? m.receitas : 0, despesas: m ? m.despesas : 0, saldo: m ? m.saldo : 0 };
  });
}

/** relatorio_mensal (Adulto): markdown do fechamento + projeção de 3 meses. */
function acaoRelatorioMensal(p, ctx) {
  const comp = String(p.competencia || somarMeses(competenciaDe(), -1));
  const d = carregarDados();
  const visao = visaoDe(ctx);
  return { markdown: gerarPautaMarkdown(d, visao, comp, versiculoDoDia('família'), 'Relatório do mês'), projecao: projetarTresMeses(d, visao, comp) };
}

// ---------- Patrimônio (manual) ----------

const TIPOS_PATRIMONIO = ['conta', 'poupanca', 'investimento', 'imovel', 'veiculo', 'outro'];

/** Converte a linha da aba (saldos em JSON) no objeto Patrimonio. */
function patrimonioPublico(r) {
  let saldos = [];
  try { saldos = typeof r.saldos === 'string' ? (r.saldos ? JSON.parse(r.saldos) : []) : (r.saldos || []); } catch (e) { saldos = []; }
  saldos = saldos.map((s) => ({ competencia: String(s.competencia), valor: arredondar(s.valor) })).sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  return { id: r.id, nome: r.nome, tipo: r.tipo, instituicao: r.instituicao || '', titular_id: r.titular_id || '', saldos, ativo: !!r.ativo };
}

function acaoListarPatrimonio() {
  return lerAba('Patrimonio').map(patrimonioPublico);
}

/** salvar_patrimonio (Administrador). */
function acaoSalvarPatrimonio(p) {
  const pt = p.patrimonio || {};
  if (!pt.nome) throw new ErroUsuario('Dê um nome ao item (ex.: "Conta corrente").');
  const existente = pt.id ? buscarPorId('Patrimonio', pt.id) : null;
  const saldos = Array.isArray(pt.saldos) ? pt.saldos : (existente ? patrimonioPublico(existente).saldos : []);
  const novo = {
    id: pt.id || gerarId('pt'), nome: String(pt.nome).trim(), tipo: TIPOS_PATRIMONIO.indexOf(pt.tipo) >= 0 ? pt.tipo : 'outro',
    instituicao: pt.instituicao || '', titular_id: pt.titular_id || '',
    saldos: JSON.stringify(saldos.filter((s) => s && s.competencia).map((s) => ({ competencia: String(s.competencia), valor: lerValor(s.valor) }))),
    ativo: pt.ativo === undefined ? true : paraBooleano(pt.ativo),
  };
  return patrimonioPublico(salvarPorId('Patrimonio', novo));
}

/** registrar_saldo_patrimonio (Adulto): grava/substitui o saldo de uma competência. */
function acaoRegistrarSaldoPatrimonio(p) {
  const r = buscarPorId('Patrimonio', String(p.id || ''));
  if (!r) throw new ErroUsuario('Item não encontrado');
  const comp = String(p.competencia || competenciaDe());
  if (!/^\d{4}-\d{2}$/.test(comp)) throw new ErroUsuario('Competência inválida (use AAAA-MM).');
  const saldos = patrimonioPublico(r).saldos.filter((s) => s.competencia !== comp).concat([{ competencia: comp, valor: lerValor(p.valor) }]);
  return patrimonioPublico(atualizarPorId('Patrimonio', r.id, { saldos: JSON.stringify(saldos) }));
}

// ---------- Versículo do dia ----------

/** Rotação determinística pelo dia (todo mundo vê o mesmo versículo no mesmo dia). */
function versiculoDoDia(tema) {
  let lista = lerAba('Versiculos');
  if (!lista.length) lista = dadosIniciaisVersiculos();
  const filtrada = tema ? lista.filter((v) => v.tema === tema) : lista;
  const usar = filtrada.length ? filtrada : lista;
  const dia = Math.floor(Date.now() / 86400000);
  return usar[dia % usar.length];
}

function acaoVersiculoDoDia(p) {
  return versiculoDoDia(p.tema);
}

// ---------- Configuração ----------

const CONFIG_EDITAVEIS = ['nome_familia', 'sobrenome', 'url_brasao', 'url_foto_capa', 'versiculo_lema', 'moeda', 'dia_fechamento_mes', 'lembrete_horario', 'fe_ativa',
  'divisao_dar', 'divisao_poupar', 'divisao_viver', 'valor_gasto_grande', 'regra_votacao', 'dependente_ve_salarios', 'rotina_vigia', 'rotina_quinzenal', 'rotina_fechamento', 'telegram_ativo'];
const CHAVES_ROTINAS = ['lembrete_horario', 'rotina_vigia', 'rotina_quinzenal', 'rotina_fechamento'];

/** salvar_config (Administrador): só as chaves públicas; reinstala os gatilhos das rotinas quando elas mudam. */
function acaoSalvarConfig(p, ctx) {
  const entrada = p.config || {};
  if (entrada.junior_ve_salarios !== undefined && entrada.dependente_ve_salarios === undefined) entrada.dependente_ve_salarios = entrada.junior_ve_salarios; // nome antigo
  const mudancas = {};
  CONFIG_EDITAVEIS.forEach((k) => { if (entrada[k] !== undefined) mudancas[k] = entrada[k]; });
  if (mudancas.lembrete_horario && !/^\d{2}:\d{2}$/.test(String(mudancas.lembrete_horario))) throw new ErroUsuario('Horário do lembrete inválido (use HH:MM).');
  if (mudancas.regra_votacao && ['maioria', 'maioria_mais_pais'].indexOf(mudancas.regra_votacao) < 0) throw new ErroUsuario('Regra de votação inválida.');
  const antes = ctx.config || {};
  const cfg = salvarConfigChaves(mudancas);
  const mudouRotina = CHAVES_ROTINAS.some((k) => mudancas[k] !== undefined && String(paraBooleano(mudancas[k])) + String(mudancas[k]) !== String(paraBooleano(antes[k])) + String(antes[k]));
  if (mudouRotina) {
    try { instalarGatilhosRotinas(cfg); } catch (e) { console.warn('Não reinstalei os gatilhos das rotinas: ' + e.message); }
  }
  return cfg;
}

// ---------- Arquivos de identidade ----------

/** enviar_arquivo (Adulto): salva imagem em Identidade da Família ou Projetos e Sonhos. */
function acaoEnviarArquivo(p) {
  const pastaNome = p.pasta === 'Projetos e Sonhos' ? 'Projetos e Sonhos' : 'Identidade da Família';
  const base64 = String(p.imagem_base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64) throw new ErroUsuario('Nenhum arquivo recebido.');
  const mime = String(p.mime || 'image/jpeg');
  if (!/^image\//.test(mime)) throw new ErroUsuario('Envie uma imagem (JPG, PNG, WEBP ou SVG).');
  const nome = String(p.nome_arquivo || ('imagem_' + Date.now())).replace(/[^\w.\- ]/g, '');
  const arquivo = pastaPorCaminho(pastaNome).createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, nome));
  compartilharComLink(arquivo);
  return { url: urlVisualizacao(arquivo.getId()), id: arquivo.getId() };
}

/**
 * salvar_brasao_svg (Administrador): salva o SVG em Identidade da Família e grava url_brasao na Config.
 * Gerar PNG a partir de SVG não é viável no Apps Script (não há rasterizador), então os ícones
 * 192/512 apontam para o MESMO SVG — o app usa SVG no manifest e o service worker cuida do resto.
 */
function acaoSalvarBrasaoSvg(p) {
  const svg = String(p.svg || '').trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new ErroUsuario('O brasão precisa ser um SVG válido.');
  if (/<script/i.test(svg)) throw new ErroUsuario('O SVG não pode conter scripts.');
  const pasta = pastaPorCaminho('Identidade da Família');
  // Substitui o brasão anterior (mantém só um arquivo com esse nome).
  const antigos = pasta.getFilesByName('brasao.svg');
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  const arquivo = pasta.createFile(Utilities.newBlob(svg, 'image/svg+xml', 'brasao.svg'));
  compartilharComLink(arquivo);
  const url = urlVisualizacao(arquivo.getId());
  salvarConfigChaves({ url_brasao: url });
  return { url_brasao: url, url_icone_192: url, url_icone_512: url };
}
