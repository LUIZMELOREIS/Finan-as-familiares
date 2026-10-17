/**
 * familia.gs — Sonhos (projetos e aportes), Conselho (decisões e votos), Reunião mensal,
 * versículo do dia, configuração e arquivos de identidade (foto de capa, brasão).
 */

// ---------- Projetos (sonhos) ----------

/** valor_atual = valor_inicial + soma dos aportes. */
function comValorAtual(projeto, aportes) {
  const soma = (aportes || lerAba('Aportes')).filter((a) => a.projeto_id === projeto.id).reduce((s, a) => s + a.valor, 0);
  return Object.assign({}, projeto, { valor_atual: arredondar(projeto.valor_inicial + soma) });
}

function acaoListarProjetos() {
  const aportes = lerAba('Aportes');
  return lerAba('Projetos').map((p) => comValorAtual(p, aportes)).sort((a, b) => a.prioridade - b.prioridade);
}

function acaoSalvarProjeto(p, ctx) {
  const pr = p.projeto || {};
  if (!pr.nome) throw new ErroUsuario('Dê um nome ao sonho.');
  const meta = lerValor(pr.meta_valor);
  if (!(meta > 0)) throw new ErroUsuario('Informe o valor da meta.');
  const existente = pr.id ? buscarPorId('Projetos', pr.id) : null;
  // Júnior só pode criar um sonho próprio (prioridade baixa) e editar os que ele mesmo criou.
  if (ctx.usuario && ctx.usuario.perfil === 'Júnior') {
    if (existente && existente.criado_por !== ctx.uid) throw new ErroUsuario('Sem permissão');
    pr.criado_por = ctx.uid;
    if (!existente) pr.prioridade = Math.max(Number(pr.prioridade) || 0, 4);
  }
  const novo = {
    id: pr.id || gerarId('p'), nome: pr.nome, icone: pr.icone || '⭐', foto_url: pr.foto_url || '', meta_valor: meta,
    data_alvo: normalizarDataIso(pr.data_alvo) || somarMeses(competenciaDe(), 12) + '-01', valor_inicial: lerValor(pr.valor_inicial),
    prioridade: Number(pr.prioridade) || (existente ? existente.prioridade : lerAba('Projetos').length + 1),
    status: ['votação', 'ativo', 'concluído', 'pausado'].indexOf(pr.status) >= 0 ? pr.status : (existente ? existente.status : 'ativo'),
    versiculo: pr.versiculo || '', criado_por: existente ? existente.criado_por : (pr.criado_por || ctx.uid),
    criado_em: existente ? existente.criado_em : (pr.criado_em || agoraIso()),
  };
  return comValorAtual(salvarPorId('Projetos', novo));
}

/** Marca o projeto como concluído quando o valor atual bate a meta. */
function verificarMetaProjeto(projetoId) {
  const pr = buscarPorId('Projetos', projetoId);
  if (!pr) return null;
  const atual = comValorAtual(pr);
  if (atual.valor_atual >= pr.meta_valor && pr.status !== 'concluído') atualizarPorId('Projetos', pr.id, { status: 'concluído' });
  return atual;
}

/** aportar: registra o aporte e o lançamento em c_aporte_sonho. */
function acaoAportar(p, ctx) {
  const pr = buscarPorId('Projetos', String(p.projeto_id || ''));
  if (!pr) throw new ErroUsuario('Sonho não encontrado');
  const valor = lerValor(p.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe um valor maior que zero.');
  const hoje = hojeIso();
  const aporte = inserirLinhas('Aportes', [{ id: gerarId('a'), projeto_id: pr.id, data: hoje, valor, usuario_id: ctx.uid, observacao: String(p.observacao || '') }])[0];
  inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data: hoje, competencia: competenciaDe(hoje), tipo: 'despesa', valor, categoria_id: 'c_aporte_sonho',
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
  const pais = lerAba('Usuarios').filter((u) => u.perfil === 'Administrador').map((u) => u.id);
  const aprovada = aplicarRegraVotacao(votos, ctx.config.regra_votacao, pais);
  const atualizada = atualizarPorId('Decisoes', d.id, { status: aprovada ? 'aprovada' : 'recusada' });
  if (d.projeto_id && buscarPorId('Projetos', d.projeto_id)) atualizarPorId('Projetos', d.projeto_id, { status: aprovada ? 'ativo' : 'pausado' });
  return Object.assign({}, atualizada, { votos });
}

// ---------- Reunião mensal ----------

/** Gera a pauta em markdown (mesmo texto do modo demonstração). */
function gerarPauta(ctx, comp) {
  const r = calcularResumoMes(ctx, comp);
  const ant = calcularResumoMes(ctx, somarMeses(comp, -1));
  const catMap = {};
  lerAba('Categorias').forEach((c) => { catMap[c.id] = c; });
  const estouradas = Object.keys(r.por_categoria).filter((id) => r.por_categoria[id].orcado && r.por_categoria[id].realizado > r.por_categoria[id].orcado)
    .map((id) => '- ' + (catMap[id] ? catMap[id].icone : '') + ' ' + (catMap[id] ? catMap[id].nome : id) + ': ' + moeda(r.por_categoria[id].realizado) + ' de ' + moeda(r.por_categoria[id].orcado) + ' planejados');
  const contas = lerAba('ContasAPagar');
  const subiram = lerAba('ContasFixas').map((cf) => {
    const a = contas.find((c) => c.conta_fixa_id === cf.id && c.competencia === comp);
    const pAnt = contas.find((c) => c.conta_fixa_id === cf.id && c.competencia === somarMeses(comp, -1));
    if (a && pAnt && pAnt.valor > 0 && a.valor / pAnt.valor > 1.2) return '- ' + cf.nome + ': subiu ' + Math.round((a.valor / pAnt.valor - 1) * 100) + '% (' + moeda(pAnt.valor) + ' → ' + moeda(a.valor) + ')';
    return null;
  }).filter(Boolean);
  const aportes = lerAba('Aportes');
  const sonhos = lerAba('Projetos').filter((pr) => pr.status === 'ativo').map((pr) => {
    const atual = comValorAtual(pr, aportes).valor_atual;
    return '- ' + pr.icone + ' ' + pr.nome + ': ' + Math.round((atual / pr.meta_valor) * 100) + '% (' + moeda(atual) + ' de ' + moeda(pr.meta_valor) + ')';
  });
  const abertas = lerAba('Decisoes').filter((d) => d.status === 'aberta').map((d) => '- ' + d.titulo + ' (prazo ' + d.prazo + ')');
  const v = versiculoDoDia('família');
  return [
    '# Reunião da Família — ' + comp,
    '', '## 1. Como fechou o mês',
    '- Entrou: ' + moeda(r.entrou) + ' · Saiu: ' + moeda(r.saiu) + ' · Sobrou: ' + moeda(r.sobrou) + ' ' + (r.sobrou >= 0 ? '✅' : '⚠️'),
    '- Mês anterior sobrou: ' + moeda(ant.sobrou),
    '', '## 2. O que estourou'].concat(estouradas.length ? estouradas : ['- Nada estourou. Glória a Deus!'],
    ['', '## 3. Contas que subiram'], subiram.length ? subiram : ['- Nenhuma conta subiu mais de 20%.'],
    ['', '## 4. Situação dos sonhos'], sonhos.length ? sonhos : ['- Nenhum sonho ativo.'],
    ['', '## 5. Decisões abertas'], abertas.length ? abertas : ['- Nenhuma.'],
    ['', '## 6. Para refletir', '> "' + v.texto + '" — ' + v.referencia,
     '', '## 7. O que decidimos', '_(preencher)_', '', '## 8. Motivo de oração e gratidão', '_(preencher)_']).join('\n');
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

const CONFIG_EDITAVEIS = ['nome_familia', 'sobrenome', 'url_brasao', 'url_foto_capa', 'versiculo_lema', 'moeda', 'dia_fechamento_mes', 'lembrete_horario', 'fe_ativa', 'divisao_dar', 'divisao_poupar', 'divisao_viver', 'valor_gasto_grande', 'regra_votacao', 'junior_ve_salarios'];

/** salvar_config (Administrador): só as chaves públicas; reinstala o lembrete se o horário mudar. */
function acaoSalvarConfig(p, ctx) {
  const entrada = p.config || {};
  const mudancas = {};
  CONFIG_EDITAVEIS.forEach((k) => { if (entrada[k] !== undefined) mudancas[k] = entrada[k]; });
  if (mudancas.lembrete_horario && !/^\d{2}:\d{2}$/.test(String(mudancas.lembrete_horario))) throw new ErroUsuario('Horário do lembrete inválido (use HH:MM).');
  if (mudancas.regra_votacao && ['maioria', 'maioria_mais_pais'].indexOf(mudancas.regra_votacao) < 0) throw new ErroUsuario('Regra de votação inválida.');
  const cfg = salvarConfigChaves(mudancas);
  if (mudancas.lembrete_horario && mudancas.lembrete_horario !== (ctx.config || {}).lembrete_horario) {
    try { instalarGatilhoLembrete(mudancas.lembrete_horario); } catch (e) { console.warn('Não reinstalei o gatilho do lembrete: ' + e.message); }
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
