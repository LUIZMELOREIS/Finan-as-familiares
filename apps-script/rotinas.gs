/**
 * rotinas.gs — Previsão de saídas, avisos do assistente, alertas personalizados e as três rotinas
 * automáticas (gatilhos do Apps Script, cada uma liga/desliga em Configurações):
 *
 *  - vigiaDiario() (todo dia na hora do lembrete, padrão 20h): gasto fora do padrão (> 1,35× a média
 *    de 3 meses), cobrança duplicada no cartão, assinatura nova, conta a vencer em 3 dias ou atrasada,
 *    gastos de cartão sem categoria, alertas personalizados e o lembrete "lance os gastos de hoje".
 *    Os avisos vão para a aba Avisos e são enviados (e-mail/push/Telegram) aos administradores ou
 *    às pessoas marcadas em `avisar` no alerta. Cada aviso é enviado uma vez (id estável).
 *  - analiseQuinzenal() (dias 1 e 16): tendências por categoria contra a média de 3 meses e uma
 *    recomendação objetiva.
 *  - fechamentoDoMes() (dia 1º): relatório do mês anterior, projeção de 3 meses e pauta da reunião
 *    → e-mail aos administradores, aba Avisos e aba Reunioes.
 *
 * As funções calcularProximasSaidas / gerarAvisos / alertasCalculados / analisarTendencias são PURAS
 * (recebem os dados de carregarDados() e a data de hoje) e têm o mesmo comportamento do modo
 * demonstração (app/src/api/mock.ts).
 */

const FATOR_FORA_DO_PADRAO = 1.35;
const MINIMO_MEDIA_PARA_AVISO = 50;
const CATEGORIAS_ASSINATURA = ['c_streaming', 'c_apps', 'c_seguros'];

// ---------- Próximas saídas (30/60/90 dias) ----------

/**
 * Saídas previstas: contas a pagar abertas (lidas do e-mail ou previstas), contas fixas ainda sem
 * fatura (estimadas), parcelas futuras de cartão e a fatura do ciclo aberto de cada cartão.
 */
function calcularProximasSaidas(d, dias, hoje) {
  const h = hoje || hojeIso();
  const limite = somarDias(h, Number(dias) || 30);
  const compAtual = h.slice(0, 7);
  const cfMap = indexarPorId(d.contas_fixas);
  const catMap = indexarPorId(d.categorias);
  const icone = (catId, padrao) => (catMap[catId] && catMap[catId].icone) || padrao;
  const saidas = [];
  d.contas_a_pagar.filter((c) => c.status === 'aberta' && c.vencimento >= h && c.vencimento <= limite).forEach((c) => {
    const cf = cfMap[c.conta_fixa_id];
    const lida = !!(c.anexo_url || c.linha_digitavel);
    saidas.push({ id: c.id, data: c.vencimento, titulo: cf ? cf.nome : 'Conta', subtitulo: lida ? 'fatura lida do e-mail' : 'recorrente', valor: arredondar(c.valor), icone: icone(cf ? cf.categoria_id : '', 'receipt'), status: lida ? 'lida_do_email' : 'prevista', rota: '/contas' });
  });
  d.contas_fixas.filter((cf) => cf.ativa).forEach((cf) => {
    [compAtual, somarMeses(compAtual, 1), somarMeses(compAtual, 2), somarMeses(compAtual, 3)].forEach((comp) => {
      const venc = comp + '-' + zeros(Math.min(Number(cf.dia_vencimento) || 10, ultimoDiaDoMes(comp)));
      if (venc < h || venc > limite) return;
      if (d.contas_a_pagar.some((c) => c.conta_fixa_id === cf.id && c.competencia === comp)) return;
      saidas.push({ id: 'est_' + cf.id + '_' + comp, data: venc, titulo: cf.nome, subtitulo: 'aguardando fatura', valor: arredondar(cf.valor_previsto), icone: icone(cf.categoria_id, 'receipt'), status: 'estimada', rota: '/contas' });
    });
  });
  const cartMap = indexarPorId(d.cartoes);
  d.lancamentos.filter((l) => !l.excluido && l.parcela && l.status === 'a_confirmar' && l.competencia >= compAtual).forEach((l) => {
    const k = cartMap[l.cartao_id];
    const data = l.competencia + '-' + zeros(Math.min(Number(k ? k.dia_vencimento : 10) || 10, ultimoDiaDoMes(l.competencia)));
    if (data < h || data > limite) return;
    saidas.push({ id: l.id, data, titulo: l.descricao + ' — parcela ' + l.parcela, subtitulo: 'cartão ' + (k ? k.apelido : '') + ' final ' + (k ? k.final : ''), valor: arredondar(l.valor), icone: icone(l.categoria_id, 'credit-card'), status: 'parcela' });
  });
  d.cartoes.filter((k) => k.ativo).forEach((k) => {
    const compras = d.lancamentos.filter((l) => !l.excluido && l.cartao_id === k.id && l.competencia === compAtual && l.status === 'confirmado');
    if (!compras.length) return;
    const fecha = compAtual + '-' + zeros(Math.min(Number(k.dia_fechamento) || 1, ultimoDiaDoMes(compAtual)));
    const prox = somarMeses(compAtual, 1);
    const data = fecha >= h ? fecha : prox + '-' + zeros(Math.min(Number(k.dia_fechamento) || 1, ultimoDiaDoMes(prox)));
    if (data > limite) return;
    saidas.push({ id: 'fat_' + k.id, data, titulo: 'Cartão ' + k.apelido + ' final ' + k.final, subtitulo: 'fecha ' + data.slice(8, 10) + '/' + data.slice(5, 7) + ' · ' + compras.length + ' compras', valor: arredondar(somar(compras, (l) => l.valor)), icone: 'credit-card', status: 'parcial', rota: '/caixa' });
  });
  return saidas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

function acaoProximasSaidas(p) {
  const dias = [30, 60, 90].indexOf(Number(p.dias)) >= 0 ? Number(p.dias) : 30;
  return calcularProximasSaidas(carregarDados(), dias);
}

// ---------- Vigia: avisos ----------

/** Total gasto numa categoria numa competência (lançamentos confirmados de despesa). */
function totalCategoriaNoMes(ls, categoriaId, comp) {
  return somar(ls.filter((l) => l.categoria_id === categoriaId && l.competencia === comp), (l) => l.valor);
}

/** Média dos 3 meses anteriores a `comp` para a categoria. */
function mediaCategoria3m(ls, categoriaId, comp) {
  return media([1, 2, 3].map((k) => totalCategoriaNoMes(ls, categoriaId, somarMeses(comp, -k))));
}

/** Despesas confirmadas (sem aportes), base de todos os cálculos do vigia. */
function despesasConfirmadas(d) {
  const catMap = indexarPorId(d.categorias);
  return d.lancamentos.filter((l) => !l.excluido && l.status === 'confirmado' && l.tipo === 'despesa' && ehDespesaReal(catMap[l.categoria_id]));
}

/**
 * Assinaturas detectadas (função pura): lojas cobradas no crédito, valor < R$ 200, que aparecem em
 * pelo menos 2 dos últimos 3 meses. Devolve [{ loja, estabelecimento, valor, competencias[], categoria_id, nova }].
 * `nova` = começou nos últimos 2 meses (ninguém cadastrou antes).
 */
function detectarAssinaturas(d, hoje) {
  const comp = (hoje || hojeIso()).slice(0, 7);
  const ls = despesasConfirmadas(d).filter((l) => l.forma_pgto === 'crédito' && l.valor < 200);
  const porLoja = {};
  ls.forEach((l) => {
    const k = normalizar(l.estabelecimento);
    if (!k) return;
    porLoja[k] = porLoja[k] || { loja: k, estabelecimento: l.estabelecimento, valor: l.valor, categoria_id: l.categoria_id, competencias: {} };
    porLoja[k].competencias[l.competencia] = true;
    if (l.competencia >= porLoja[k].ultima || !porLoja[k].ultima) { porLoja[k].ultima = l.competencia; porLoja[k].valor = l.valor; }
  });
  const janela = [comp, somarMeses(comp, -1), somarMeses(comp, -2)];
  return Object.keys(porLoja).map((k) => {
    const a = porLoja[k];
    const comps = Object.keys(a.competencias).sort();
    const recentes = comps.filter((c) => janela.indexOf(c) >= 0);
    if (recentes.length < 2) return null;
    const nova = comps.length <= 3 && comps[0] >= somarMeses(comp, -2) && comps.indexOf(comp) >= 0;
    return { loja: a.loja, estabelecimento: a.estabelecimento, valor: arredondar(a.valor), competencias: comps, categoria_id: a.categoria_id, desde: comps[0], nova };
  }).filter(Boolean);
}

/**
 * Vigia diário: gera os avisos a partir dos dados (sem precisar de IA). Função pura.
 * Os ids são estáveis (mesmo aviso → mesmo id), o que permite marcar como lido e não reenviar.
 */
function gerarAvisos(d, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const ls = despesasConfirmadas(d);
  const avisos = [];
  // 1. Gasto fora do padrão (categorias variáveis): > 1,35× a média dos 3 meses anteriores.
  d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).forEach((cat) => {
    const atual = totalCategoriaNoMes(ls, cat.id, comp);
    const med = mediaCategoria3m(ls, cat.id, comp);
    if (med > MINIMO_MEDIA_PARA_AVISO && atual > med * FATOR_FORA_DO_PADRAO) {
      avisos.push({ id: 'av_fora_' + cat.id, data: h, tipo: 'fora_do_padrao', titulo: cat.nome + ' ' + Math.round((atual / med - 1) * 100) + '% acima da média', detalhe: moeda(atual) + ' em ' + nomeMes(comp) + ' contra ' + moeda(med) + ' de média', gravidade: 'red', acao: { rotulo: 'ver', rota: '/tipo/' + (cat.tipo_id || TIPO_VARIAVEIS) + '?categoria=' + cat.id } });
    }
  });
  // 2. Cobrança duplicada no cartão (mesmo valor, loja e dia).
  const vistos = {};
  ls.filter((l) => l.competencia === comp && l.forma_pgto === 'crédito').forEach((l) => {
    const chave = Number(l.valor).toFixed(2) + '|' + normalizar(l.estabelecimento) + '|' + l.data;
    if (vistos[chave] && !avisos.some((a) => a.id === 'av_dup_' + chave)) {
      avisos.push({ id: 'av_dup_' + chave, data: h, tipo: 'cobranca_duplicada', titulo: 'Cobrança repetida no cartão', detalhe: l.estabelecimento + ' ' + moeda(l.valor) + ' duas vezes em ' + l.data.slice(8, 10) + '/' + l.data.slice(5, 7), gravidade: 'warn', acao: { rotulo: 'conferir', rota: '/tipo/' + TIPO_VARIAVEIS + '?categoria=' + l.categoria_id } });
    }
    vistos[chave] = true;
  });
  // 3. Assinatura nova (recorrência recente que não existia antes).
  detectarAssinaturas(d, h).filter((a) => a.nova).forEach((a) => {
    avisos.push({ id: 'av_ass_' + a.loja, data: h, tipo: 'nova_assinatura', titulo: 'Assinatura nova detectada', detalhe: a.estabelecimento + ' ' + moeda(a.valor) + ' desde ' + nomeCompetencia(a.desde, true) + ' — confira se é esperada', gravidade: 'warn', acao: { rotulo: 'categorizar', rota: '/caixa' } });
  });
  // 4. Contas a vencer em 3 dias ou atrasadas.
  const cfMap = indexarPorId(d.contas_fixas);
  d.contas_a_pagar.filter((c) => c.status === 'aberta').forEach((c) => {
    const dias = diferencaDias(h, c.vencimento);
    const nome = cfMap[c.conta_fixa_id] ? cfMap[c.conta_fixa_id].nome : 'Conta';
    if (dias >= 0 && dias <= 3) avisos.push({ id: 'av_venc_' + c.id, data: h, tipo: 'vencimento', titulo: nome + ' vence ' + (dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias > 1 ? 's' : '')), detalhe: moeda(c.valor) + ' · ' + (c.linha_digitavel ? 'código de barras disponível' : 'aguardando fatura'), gravidade: dias === 0 ? 'red' : 'warn', acao: { rotulo: 'pagar', rota: '/contas' } });
    else if (dias < 0) avisos.push({ id: 'av_atr_' + c.id, data: h, tipo: 'vencimento', titulo: nome + ' venceu há ' + (-dias) + ' dia' + (-dias > 1 ? 's' : ''), detalhe: moeda(c.valor), gravidade: 'red', acao: { rotulo: 'pagar', rota: '/contas' } });
  });
  // 5. Gastos de cartão sem categoria (caixa de entrada pendente).
  const pend = d.caixa_entrada.filter((c) => c.status === 'pendente').length;
  if (pend) avisos.push({ id: 'av_semcat', data: h, tipo: 'sem_categoria', titulo: pend + ' gasto' + (pend > 1 ? 's' : '') + ' do cartão sem categoria', detalhe: 'Capturados por SMS — um toque para classificar', gravidade: 'proj', acao: { rotulo: 'abrir', rota: '/caixa' } });
  // 6. Alertas personalizados disparados.
  alertasCalculados(d, h).filter((al) => al.ativo && al.status_atual === 'disparado').forEach((al) => {
    const total = al.total_atual;
    const rota = al.categoria_id ? '/tipo/' + TIPO_VARIAVEIS + '?categoria=' + al.categoria_id : (al.grupo_id ? '/tipo/' + TIPO_VARIAVEIS + '?grupo=' + al.grupo_id : '/caixa');
    avisos.push({ id: 'av_al_' + al.id, data: h, tipo: 'alerta_personalizado', titulo: al.nome, detalhe: total !== undefined ? moeda(total) + ' no mês (limite ' + moeda(al.limite) + ')' : (al.detalhe || ''), gravidade: 'red', acao: { rotulo: 'ver', rota }, avisar: al.avisar || [] });
  });
  const lidos = {};
  (d.avisos || []).forEach((a) => { if (a.lido) lidos[a.id] = true; });
  return avisos.map((a) => Object.assign(a, { lido: !!lidos[a.id] }));
}

// ---------- Alertas personalizados ----------

/** Alertas com status_atual e percentual_atual calculados (função pura). */
function alertasCalculados(d, hoje) {
  const h = hoje || hojeIso();
  const comp = h.slice(0, 7);
  const ls = despesasConfirmadas(d).filter((l) => l.competencia === comp);
  const catMap = indexarPorId(d.categorias);
  const assinaturasNovas = detectarAssinaturas(d, h).filter((a) => a.nova);
  return (d.alertas || []).map((al) => {
    const base = Object.assign({}, al, { avisar: Array.isArray(al.avisar) ? al.avisar : String(al.avisar || '').split(';').filter(Boolean), ativo: !!al.ativo, limite: Number(al.limite) || 0 });
    if (al.tipo === 'categoria_acima' || al.tipo === 'grupo_acima') {
      const total = somar(ls.filter((l) => (al.categoria_id ? l.categoria_id === al.categoria_id : (catMap[l.categoria_id] || {}).grupo_id === al.grupo_id)), (l) => l.valor);
      const pct = base.limite ? Math.round((total / base.limite) * 100) : 0;
      return Object.assign(base, { total_atual: arredondar(total), percentual_atual: pct, status_atual: base.limite && total > base.limite ? 'disparado' : 'ok' });
    }
    if (al.tipo === 'nova_assinatura') return Object.assign(base, { status_atual: assinaturasNovas.length ? 'disparado' : 'ok', detalhe: assinaturasNovas.map((a) => a.estabelecimento + ' ' + moeda(a.valor)).join(', ') });
    if (al.tipo === 'fora_do_padrao') {
      const fora = d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).filter((c) => { const m = mediaCategoria3m(despesasConfirmadas(d), c.id, comp); return m > MINIMO_MEDIA_PARA_AVISO && totalCategoriaNoMes(ls, c.id, comp) > m * FATOR_FORA_DO_PADRAO; });
      return Object.assign(base, { status_atual: fora.length ? 'disparado' : 'ok', detalhe: fora.map((c) => c.nome).join(', ') });
    }
    if (al.tipo === 'cobranca_duplicada') {
      const vistos = {}; let dup = 0;
      ls.filter((l) => l.forma_pgto === 'crédito').forEach((l) => { const k = Number(l.valor).toFixed(2) + '|' + normalizar(l.estabelecimento) + '|' + l.data; if (vistos[k]) dup++; vistos[k] = true; });
      return Object.assign(base, { status_atual: dup ? 'disparado' : 'ok', detalhe: dup + ' cobrança(s) repetida(s)' });
    }
    return Object.assign(base, { status_atual: 'ok' });
  });
}

/** Versão para o app (sem campos internos). */
function alertaPublico(al) {
  const o = Object.assign({}, al);
  delete o.total_atual; delete o.detalhe;
  return o;
}

function acaoListarAlertas() {
  return alertasCalculados(carregarDados()).map(alertaPublico);
}

const TIPOS_ALERTA = ['categoria_acima', 'grupo_acima', 'nova_assinatura', 'cobranca_duplicada', 'fora_do_padrao'];

/** salvar_alerta (Adulto). */
function acaoSalvarAlerta(p) {
  const a = p.alerta || {};
  if (!a.nome) throw new ErroUsuario('Dê um nome ao alerta (ex.: "Delivery acima de R$ 400/mês").');
  if (TIPOS_ALERTA.indexOf(a.tipo) < 0) throw new ErroUsuario('Tipo de alerta inválido.');
  if (a.tipo === 'categoria_acima' && !(a.categoria_id && buscarPorId('Categorias', a.categoria_id))) throw new ErroUsuario('Escolha a categoria do alerta.');
  if (a.tipo === 'grupo_acima' && !(a.grupo_id && buscarPorId('Grupos', a.grupo_id))) throw new ErroUsuario('Escolha o grupo do alerta.');
  const existente = a.id ? buscarPorId('Alertas', a.id) : null;
  const novo = {
    id: a.id || gerarId('al'), nome: String(a.nome).trim(), tipo: a.tipo, categoria_id: a.categoria_id || '', grupo_id: a.grupo_id || '',
    limite: lerValor(a.limite), avisar: Array.isArray(a.avisar) ? a.avisar : String(a.avisar || '').split(';').filter(Boolean),
    ativo: a.ativo === undefined ? true : paraBooleano(a.ativo), ultimo_disparo: existente ? existente.ultimo_disparo : '',
  };
  const salvo = salvarPorId('Alertas', novo);
  return alertaPublico(alertasCalculados(carregarDados()).find((x) => x.id === salvo.id));
}

function acaoExcluirAlerta(p) {
  const id = String(p.id || '');
  if (!buscarPorId('Alertas', id)) throw new ErroUsuario('Alerta não encontrado');
  removerLinhas('Alertas', (r) => r.id === id);
  return { id };
}

// ---------- Avisos (aba + calculados) ----------

/** Aviso da aba (acao em JSON) → objeto do app. */
function avisoPublico(r) {
  let acao;
  try { acao = typeof r.acao === 'string' ? (r.acao ? JSON.parse(r.acao) : undefined) : r.acao; } catch (e) { acao = undefined; }
  return semUndefined({ id: r.id, data: r.data, tipo: r.tipo, titulo: r.titulo, detalhe: r.detalhe, gravidade: r.gravidade, acao, lido: !!r.lido });
}

/**
 * Lista de avisos do app: os calculados agora (vigia) + os guardados pelas rotinas (tendência,
 * fechamento), sem repetir ids, do mais recente para o mais antigo.
 */
function listarAvisosAtuais(d, hoje) {
  const calculados = gerarAvisos(d, hoje).map((a) => { const o = Object.assign({}, a); delete o.avisar; return o; });
  const ids = {};
  calculados.forEach((a) => { ids[a.id] = true; });
  const guardados = (d.avisos || []).filter((a) => !ids[a.id] && ['tendencia', 'fechamento'].indexOf(a.tipo) >= 0).map(avisoPublico);
  return calculados.concat(guardados.sort((a, b) => (a.data < b.data ? 1 : -1)));
}

function acaoListarAvisos(p) {
  const limite = Math.min(Number(p.limite) || 20, 100);
  return listarAvisosAtuais(carregarDados()).slice(0, limite);
}

/** Grava o aviso na aba (cria ou atualiza pelo id, preservando `lido`). Devolve true se era novo. */
function guardarAviso(aviso, usuarioId) {
  const existente = buscarPorId('Avisos', aviso.id);
  const linha = { id: aviso.id, data: aviso.data, tipo: aviso.tipo, titulo: aviso.titulo, detalhe: aviso.detalhe, gravidade: aviso.gravidade, acao: aviso.acao ? JSON.stringify(aviso.acao) : '', lido: existente ? !!existente.lido : false, usuario_id: usuarioId || '' };
  if (existente) { atualizarPorId('Avisos', aviso.id, linha); return false; }
  inserirLinhas('Avisos', [linha]);
  return true;
}

function acaoMarcarAvisoLido(p, ctx) {
  const id = String(p.id || '');
  const d = carregarDados();
  const aviso = listarAvisosAtuais(d).find((a) => a.id === id);
  if (!aviso) throw new ErroUsuario('Aviso não encontrado');
  guardarAviso(aviso, ctx.uid);
  atualizarPorId('Avisos', id, { lido: true });
  return Object.assign({}, aviso, { lido: true });
}

/** Mantém a aba Avisos enxuta: remove os com mais de 90 dias. */
function limparAvisosAntigos() {
  const limite = somarDias(hojeIso(), -90);
  return removerLinhas('Avisos', (a) => String(a.data || '') < limite);
}

// ---------- Rotina 1: vigia diário ----------

/**
 * Destinatários de um aviso: `avisar` do alerta personalizado (vazio = todos os adultos), senão os
 * administradores. Devolve ids de usuário.
 */
function destinatariosDoAviso(aviso, usuarios) {
  const ativos = usuarios.filter((u) => u.ativo);
  if (aviso.tipo === 'alerta_personalizado') {
    if (aviso.avisar && aviso.avisar.length) return aviso.avisar;
    return ativos.filter((u) => normalizarPerfil(u.perfil) !== 'Dependente').map((u) => u.id);
  }
  return ativos.filter((u) => normalizarPerfil(u.perfil) === 'Administrador').map((u) => u.id);
}

/** Roda todo dia à noite. Devolve { gerados, novos, enviados }. */
function vigiaDiario() {
  const d = carregarDados();
  if (d.config.rotina_vigia === false) { console.log('vigiaDiario: rotina desligada na Config'); return lembreteDiario() ? { gerados: 0, novos: 0, enviados: 0 } : null; }
  const avisos = gerarAvisos(d);
  const novos = [];
  avisos.forEach((a) => { if (guardarAviso(a, '')) novos.push(a); });
  // Avisos "sem categoria" e de vencimento repetem todo dia; só os demais novos viram notificação.
  const paraEnviar = novos.filter((a) => a.tipo !== 'sem_categoria');
  const porPessoa = {};
  paraEnviar.forEach((a) => destinatariosDoAviso(a, d.usuarios).forEach((uid) => { porPessoa[uid] = porPessoa[uid] || []; porPessoa[uid].push(a); }));
  let enviados = 0;
  Object.keys(porPessoa).forEach((uid) => {
    const lista = porPessoa[uid];
    const titulo = lista.length === 1 ? lista[0].titulo : lista.length + ' avisos do assistente';
    const corpo = lista.map((a) => a.titulo + ' — ' + a.detalhe).join('\n');
    if (notificarUsuario(uid, titulo, corpo, '#/')) enviados++;
  });
  if (paraEnviar.length) {
    const html = '<p>Avisos de hoje:</p><ul>' + paraEnviar.map((a) => '<li><b>' + a.titulo + '</b> — ' + a.detalhe + '</li>').join('') + '</ul>';
    enviarEmailAdministradores('Vigia diário: ' + paraEnviar.length + ' aviso(s)', html);
  }
  // Alertas personalizados: registra o último disparo.
  paraEnviar.filter((a) => a.tipo === 'alerta_personalizado').forEach((a) => { try { atualizarPorId('Alertas', a.id.replace(/^av_al_/, ''), { ultimo_disparo: hojeIso() }); } catch (e) { /* ignora */ } });
  // Lembrete "lance os gastos de hoje" faz parte do vigia.
  lembreteDiario();
  try { limparAvisosAntigos(); } catch (e) { /* ignora */ }
  console.log('vigiaDiario: ' + avisos.length + ' aviso(s), ' + novos.length + ' novo(s), ' + enviados + ' pessoa(s) notificada(s)');
  return { gerados: avisos.length, novos: novos.length, enviados };
}

// ---------- Rotina 2: análise quinzenal ----------

/**
 * Tendências por categoria (função pura): compara o mês corrente, projetado para o mês inteiro pelo
 * dia de hoje, com a média dos 3 meses anteriores. Devolve { subiram[], cairam[], recomendacao }.
 */
function analisarTendencias(d, hoje) {
  const h = hoje || hojeIso();
  // Nos primeiros dias do mês (rotina do dia 1º) analisa o mês anterior inteiro.
  const inicioDoMes = Number(h.slice(8, 10)) <= 3;
  const comp = inicioDoMes ? somarMeses(h.slice(0, 7), -1) : h.slice(0, 7);
  const dia = inicioDoMes ? ultimoDiaDoMes(comp) : (Number(h.slice(8, 10)) || 1);
  const fator = ultimoDiaDoMes(comp) / dia; // projeta o mês inteiro
  const ls = despesasConfirmadas(d);
  const itens = d.categorias.filter((c) => c.tipo === 'despesa' && !c.fixa && ehDespesaReal(c)).map((c) => {
    const atual = totalCategoriaNoMes(ls, c.id, comp);
    const med = mediaCategoria3m(ls, c.id, comp);
    const projetado = atual * fator;
    return { categoria_id: c.id, nome: c.nome, cor: c.cor, atual: arredondar(atual), projetado: arredondar(projetado), media: arredondar(med), variacao: med > 0 ? Math.round((projetado / med - 1) * 100) : 0 };
  }).filter((x) => x.media > MINIMO_MEDIA_PARA_AVISO);
  const subiram = itens.filter((x) => x.variacao >= 20).sort((a, b) => b.variacao - a.variacao).slice(0, 5);
  const cairam = itens.filter((x) => x.variacao <= -20).sort((a, b) => a.variacao - b.variacao).slice(0, 3);
  let recomendacao = 'Os gastos variáveis estão dentro da média dos últimos 3 meses. Mantenham o ritmo.';
  if (subiram.length) {
    const top = subiram[0];
    const economia = Math.max(0, top.projetado - top.media);
    recomendacao = top.nome + ' caminha para ' + moeda(top.projetado) + ' no mês, ' + top.variacao + '% acima da média de ' + moeda(top.media) + '. Voltar à média liberaria cerca de ' + moeda(economia) + ' até o fim do mês.';
  }
  return { competencia: comp, subiram, cairam, recomendacao };
}

/** Roda nos dias 1 e 16. Grava um aviso "tendencia" e envia e-mail aos administradores. */
function analiseQuinzenal() {
  const d = carregarDados();
  if (d.config.rotina_quinzenal === false) { console.log('analiseQuinzenal: rotina desligada na Config'); return null; }
  const t = analisarTendencias(d);
  const h = hojeIso();
  const aviso = {
    id: 'av_tend_' + h, data: h, tipo: 'tendencia', titulo: t.subiram.length ? t.subiram.length + ' categoria(s) acima da média' : 'Gastos dentro da média',
    detalhe: t.recomendacao, gravidade: t.subiram.length ? 'warn' : 'ok', acao: { rotulo: 'ver painel', rota: '/' },
  };
  guardarAviso(aviso, '');
  const linha = (x) => '<li><b>' + x.nome + '</b>: ' + moeda(x.atual) + ' até agora (projeção ' + moeda(x.projetado) + ') contra média de ' + moeda(x.media) + ' — ' + (x.variacao > 0 ? '+' : '') + x.variacao + '%</li>';
  const html = '<p>Análise quinzenal de ' + nomeCompetencia(t.competencia) + ':</p>' +
    (t.subiram.length ? '<h3>Subiram</h3><ul>' + t.subiram.map(linha).join('') + '</ul>' : '<p>Nenhuma categoria variável está 20% acima da média.</p>') +
    (t.cairam.length ? '<h3>Caíram</h3><ul>' + t.cairam.map(linha).join('') + '</ul>' : '') +
    '<h3>Recomendação</h3><p>' + t.recomendacao + '</p>';
  enviarEmailAdministradores('Análise quinzenal', html);
  notificarPerfis(['Administrador'], 'Análise quinzenal', t.recomendacao, '#/');
  console.log('analiseQuinzenal: ' + t.subiram.length + ' subiram, ' + t.cairam.length + ' caíram');
  return t;
}

// ---------- Rotina 3: fechamento do mês ----------

/** Roda no dia 1º: relatório do mês anterior + projeção + pauta → e-mail, Avisos e Reunioes. */
function fechamentoDoMes() {
  const d = carregarDados();
  if (d.config.rotina_fechamento === false) { console.log('fechamentoDoMes: rotina desligada na Config'); return null; }
  const comp = somarMeses(competenciaDe(), -1);
  const visao = { ver_sensivel: true };
  const versiculo = versiculoDoDia('família');
  const relatorio = gerarPautaMarkdown(d, visao, comp, versiculo, 'Relatório do mês');
  const pauta = gerarPautaMarkdown(d, visao, comp, versiculo, 'Reunião da família');
  const projecao = projetarTresMeses(d, visao, comp);
  const r = calcularResumoMes(d, visao, comp);
  // Pauta da reunião fica salva (se ainda não houver uma para a competência).
  if (!lerAba('Reunioes').some((x) => x.competencia === comp)) {
    const admin = d.usuarios.find((u) => normalizarPerfil(u.perfil) === 'Administrador' && u.ativo);
    inserirLinhas('Reunioes', [{ id: gerarId('r'), competencia: comp, data: hojeIso(), pauta, decidido: '', oracao_gratidao: '', criado_por: admin ? admin.id : '' }]);
  }
  const h = hojeIso();
  guardarAviso({
    id: 'av_fech_' + comp, data: h, tipo: 'fechamento', titulo: nomeCompetencia(comp) + ': ' + (r.sobrou >= 0 ? 'sobrou ' : 'faltou ') + moeda(Math.abs(r.sobrou)),
    detalhe: 'Entrou ' + moeda(r.entrou) + ' · Saiu ' + moeda(r.saiu) + '. Pauta da reunião pronta.', gravidade: r.sobrou >= 0 ? 'ok' : 'red', acao: { rotulo: 'ver pauta', rota: '/reuniao?competencia=' + comp },
  }, '');
  const html = markdownParaHtml(relatorio) +
    '<h2>Projeção dos próximos 3 meses</h2><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr>' +
    projecao.map((m) => '<tr><td>' + nomeCompetencia(m.competencia) + '</td><td>' + moeda(m.receitas) + '</td><td>' + moeda(m.despesas) + '</td><td>' + moeda(m.saldo) + '</td></tr>').join('') + '</table>' +
    '<h2>Pauta da reunião</h2>' + markdownParaHtml(pauta);
  enviarEmailAdministradores('Fechamento de ' + nomeCompetencia(comp), html);
  notificarPerfis(['Administrador'], 'Fechamento de ' + nomeCompetencia(comp), (r.sobrou >= 0 ? 'Sobrou ' : 'Faltou ') + moeda(Math.abs(r.sobrou)) + '. A pauta da reunião está pronta.', '#/reuniao');
  console.log('fechamentoDoMes: ' + comp + ' fechado');
  return { competencia: comp, resumo: r, projecao };
}

/** Markdown simples (títulos, listas, citações, negrito) → HTML para e-mail. Função pura. */
function markdownParaHtml(md) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const negrito = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<i>($1)</i>');
  const linhas = String(md || '').split('\n');
  const saida = [];
  let emLista = false;
  linhas.forEach((ln) => {
    const li = ln.match(/^- (.*)$/);
    if (li) { if (!emLista) { saida.push('<ul>'); emLista = true; } saida.push('<li>' + negrito(esc(li[1])) + '</li>'); return; }
    if (emLista) { saida.push('</ul>'); emLista = false; }
    const h1 = ln.match(/^# (.*)$/), h2 = ln.match(/^## (.*)$/), q = ln.match(/^> (.*)$/);
    if (h1) saida.push('<h1>' + esc(h1[1]) + '</h1>');
    else if (h2) saida.push('<h2>' + esc(h2[1]) + '</h2>');
    else if (q) saida.push('<blockquote>' + esc(q[1]) + '</blockquote>');
    else if (ln.trim()) saida.push('<p>' + negrito(esc(ln)) + '</p>');
  });
  if (emLista) saida.push('</ul>');
  return saida.join('\n');
}
