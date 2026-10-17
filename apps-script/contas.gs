/**
 * contas.gs — Contas fixas (cadastro) e contas a pagar (boletos do mês).
 *
 *  - CRUD de ContasFixas e ContasAPagar;
 *  - marcar_conta_paga: cria o lançamento real, marca o previsto como excluído;
 *  - consumo_historico: série de consumo (kWh, m³...) por conta;
 *  - criarContaAPagarDeLeitura: usado por email.gs e pela pasta _Entrada;
 *  - avisarVencimentos (gatilho diário 08h): 3 dias antes e no dia → e-mail aos administradores + push;
 *  - alerta de consumo: conta com valor 20% acima da média dos 3 meses anteriores.
 */

const DIAS_AVISO_VENCIMENTO = 3;
const LIMITE_ALERTA_CONSUMO = 1.2; // +20%

// ---------- Contas fixas ----------

function acaoListarContasFixas() {
  return lerAba('ContasFixas');
}

function acaoSalvarContaFixa(p) {
  const c = p.conta_fixa || {};
  if (!c.nome) throw new ErroUsuario('A conta precisa de um nome (ex.: "Copel (luz)").');
  if (!c.categoria_id || !buscarPorId('Categorias', c.categoria_id)) throw new ErroUsuario('Escolha a categoria da conta.');
  const nova = {
    id: c.id || gerarId('f'), nome: c.nome, categoria_id: c.categoria_id, valor_previsto: lerValor(c.valor_previsto),
    dia_vencimento: Math.min(Math.max(Number(c.dia_vencimento) || 10, 1), 31), remetente_email: c.remetente_email || '',
    codigo_cliente: c.codigo_cliente || '', ativa: c.ativa === undefined ? true : paraBooleano(c.ativa),
  };
  return salvarPorId('ContasFixas', nova);
}

// ---------- Contas a pagar ----------

function contaPublica(c) {
  return Object.assign({}, c, { valor: arredondar(c.valor) });
}

function acaoListarContasAPagar(p) {
  let cs = lerAba('ContasAPagar');
  if (p.competencia) cs = cs.filter((c) => c.competencia === p.competencia);
  if (p.status) cs = cs.filter((c) => c.status === p.status);
  return cs.slice().sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)).map(contaPublica);
}

function acaoSalvarContaAPagar(p) {
  const c = p.conta || {};
  const venc = normalizarDataIso(c.vencimento);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) throw new ErroUsuario('Informe a data de vencimento.');
  const valor = lerValor(c.valor);
  if (!(valor > 0)) throw new ErroUsuario('Informe o valor da conta.');
  const consumoValor = c.consumo_valor === undefined || c.consumo_valor === '' ? undefined : lerValor(c.consumo_valor);
  const nova = semUndefined({
    id: c.id || gerarId('cp'), conta_fixa_id: c.conta_fixa_id || '', competencia: c.competencia || competenciaDe(venc), valor, vencimento: venc,
    linha_digitavel: c.linha_digitavel || '', pix_copia_cola: c.pix_copia_cola || '',
    consumo: c.consumo || (consumoValor ? consumoValor + ' ' + (c.consumo_unidade || '') : ''), consumo_valor: consumoValor, consumo_unidade: c.consumo_unidade || '',
    anexo_url: c.anexo_url || '', status: c.status === 'paga' ? 'paga' : 'aberta', pago_em: c.pago_em, pago_por: c.pago_por, lancamento_id: c.lancamento_id,
  });
  return contaPublica(salvarPorId('ContasAPagar', nova));
}

/**
 * marcar_conta_paga: cria o lançamento (despesa confirmada) e marca o previsto do mês como excluído.
 */
function acaoMarcarContaPaga(p, ctx) {
  const c = buscarPorId('ContasAPagar', String(p.id || ''));
  if (!c) throw new ErroUsuario('Conta não encontrada');
  if (c.status === 'paga') throw new ErroUsuario('Esta conta já está marcada como paga.');
  const cf = c.conta_fixa_id ? buscarPorId('ContasFixas', c.conta_fixa_id) : null;
  const categoriaId = cf ? cf.categoria_id : 'c_imprevistos';
  // Remove (soft delete) o previsto da mesma conta/competência.
  lerAba('Lancamentos').filter((l) => !l.excluido && l.status === 'a_confirmar' && l.competencia === c.competencia && (
    (cf && l.hash_dedup === 'previsto_' + cf.id + '_' + c.competencia) || (!cf && l.categoria_id === categoriaId)
  )).forEach((l) => atualizarPorId('Lancamentos', l.id, { excluido: true, editado_por: ctx.uid }));
  const hoje = hojeIso();
  const l = inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data: hoje, competencia: c.competencia, tipo: 'despesa', valor: c.valor, categoria_id: categoriaId,
    descricao: cf ? cf.nome : 'Conta', estabelecimento: cf ? cf.nome : '', forma_pgto: FORMAS_PGTO.indexOf(p.forma_pgto) >= 0 ? p.forma_pgto : 'boleto',
    cartao_id: '', parcela: '', usuario_id: ctx.uid, origem: 'fatura', anexo_url: c.anexo_url || '', status: 'confirmado',
    hash_dedup: hashDedup(c.valor, hoje, '', cf ? cf.nome : 'conta'), criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
  }])[0];
  const atualizada = atualizarPorId('ContasAPagar', c.id, { status: 'paga', pago_em: hoje, pago_por: ctx.uid, lancamento_id: l.id });
  return contaPublica(atualizada);
}

/** consumo_historico: série ordenada por competência. */
function acaoConsumoHistorico(p) {
  return lerAba('ContasAPagar').filter((c) => c.conta_fixa_id === p.conta_fixa_id).sort((a, b) => (a.competencia < b.competencia ? -1 : 1))
    .map((c) => ({ competencia: c.competencia, consumo_valor: Number(c.consumo_valor) || 0, consumo_unidade: c.consumo_unidade || '', valor: arredondar(c.valor) }));
}

// ---------- Criação automática (e-mail / pasta _Entrada) ----------

/**
 * Cria (ou atualiza) uma ContaAPagar a partir de uma LeituraExtraida de tipo "conta".
 * Não duplica: mesma conta fixa + competência atualiza a existente.
 * Devolve { conta, nova: boolean } ou null quando a leitura não tem valor.
 */
function criarContaAPagarDeLeitura(leitura, anexoUrl) {
  if (!leitura || !(leitura.valor > 0)) return null;
  const venc = leitura.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(leitura.vencimento) ? leitura.vencimento : somarDias(hojeIso(), 5);
  const comp = leitura.competencia && /^\d{4}-\d{2}$/.test(leitura.competencia) ? leitura.competencia : competenciaDe(venc);
  const existente = leitura.conta_fixa_id ? lerAba('ContasAPagar').find((c) => c.conta_fixa_id === leitura.conta_fixa_id && c.competencia === comp) : null;
  const dados = semUndefined({
    conta_fixa_id: leitura.conta_fixa_id || '', competencia: comp, valor: arredondar(leitura.valor), vencimento: venc,
    linha_digitavel: leitura.linha_digitavel || '', pix_copia_cola: leitura.pix_copia_cola || '',
    consumo: leitura.consumo_valor ? leitura.consumo_valor + ' ' + (leitura.consumo_unidade || '') : '',
    consumo_valor: leitura.consumo_valor, consumo_unidade: leitura.consumo_unidade || '', anexo_url: anexoUrl || leitura.anexo_url || '',
  });
  if (existente) {
    if (existente.status === 'paga') return { conta: existente, nova: false };
    return { conta: atualizarPorId('ContasAPagar', existente.id, dados), nova: false };
  }
  const nova = inserirLinhas('ContasAPagar', [Object.assign({ id: gerarId('cp'), status: 'aberta' }, dados)])[0];
  return { conta: nova, nova: true };
}

// ---------- Alerta de consumo ----------

/** Média do valor dos 3 meses anteriores da mesma conta (ou 0). */
function mediaAnterior(conta, todas) {
  const anteriores = todas.filter((c) => c.conta_fixa_id === conta.conta_fixa_id && c.competencia < conta.competencia).sort((a, b) => (a.competencia < b.competencia ? 1 : -1)).slice(0, 3);
  if (!anteriores.length) return 0;
  return anteriores.reduce((s, c) => s + c.valor, 0) / anteriores.length;
}

/** Contas abertas cujo valor passou de +20% da média anterior. */
function contasComConsumoAlto() {
  const todas = lerAba('ContasAPagar');
  const fixas = lerAba('ContasFixas');
  return todas.filter((c) => c.status === 'aberta' && c.conta_fixa_id).map((c) => {
    const media = mediaAnterior(c, todas);
    if (!media || c.valor / media < LIMITE_ALERTA_CONSUMO) return null;
    const cf = fixas.find((f) => f.id === c.conta_fixa_id);
    return { conta: c, nome: cf ? cf.nome : 'Conta', media, aumento: Math.round((c.valor / media - 1) * 100) };
  }).filter(Boolean);
}

// ---------- Aviso de vencimentos (gatilho diário 08h) ----------

/** Envia e-mail de resumo aos administradores + push para as contas que vencem em 3 dias ou hoje. */
function avisarVencimentos() {
  const hoje = hojeIso();
  const limite = somarDias(hoje, DIAS_AVISO_VENCIMENTO);
  const fixas = lerAba('ContasFixas');
  const nomeDe = (c) => { const f = fixas.find((x) => x.id === c.conta_fixa_id); return f ? f.nome : 'Conta'; };
  const abertas = lerAba('ContasAPagar').filter((c) => c.status === 'aberta');
  const hojeVence = abertas.filter((c) => c.vencimento === hoje);
  const emBreve = abertas.filter((c) => c.vencimento === limite);
  const atrasadas = abertas.filter((c) => c.vencimento < hoje);
  const consumoAlto = contasComConsumoAlto();
  if (!hojeVence.length && !emBreve.length && !atrasadas.length && !consumoAlto.length) { console.log('avisarVencimentos: nada a avisar'); return 0; }

  const linha = (c) => '<li><b>' + nomeDe(c) + '</b> — ' + moeda(c.valor) + ' — vence ' + c.vencimento.split('-').reverse().join('/') + (c.linha_digitavel ? '<br><small>Código: ' + c.linha_digitavel + '</small>' : '') + '</li>';
  const partes = [];
  if (hojeVence.length) partes.push('<h3>Vencem hoje</h3><ul>' + hojeVence.map(linha).join('') + '</ul>');
  if (emBreve.length) partes.push('<h3>Vencem em ' + DIAS_AVISO_VENCIMENTO + ' dias</h3><ul>' + emBreve.map(linha).join('') + '</ul>');
  if (atrasadas.length) partes.push('<h3>Em atraso</h3><ul>' + atrasadas.map(linha).join('') + '</ul>');
  if (consumoAlto.length) partes.push('<h3>Contas que subiram mais de 20%</h3><ul>' + consumoAlto.map((a) => '<li><b>' + a.nome + '</b>: ' + moeda(a.conta.valor) + ' (média anterior ' + moeda(a.media) + ', +' + a.aumento + '%)</li>').join('') + '</ul>');

  const total = hojeVence.length + emBreve.length + atrasadas.length;
  const assunto = 'Contas da casa: ' + (hojeVence.length ? hojeVence.length + ' vence(m) hoje' : total + ' aviso(s)');
  enviarEmailAdministradores(assunto, '<p>Resumo das contas da família:</p>' + partes.join(''));
  const resumoPush = [hojeVence.length ? hojeVence.length + ' vence(m) hoje' : '', emBreve.length ? emBreve.length + ' em ' + DIAS_AVISO_VENCIMENTO + ' dias' : '', atrasadas.length ? atrasadas.length + ' atrasada(s)' : ''].filter(Boolean).join(' · ');
  if (resumoPush) enviarPushParaPerfis(['Administrador', 'Adulto'], 'Contas da casa', resumoPush, '#/contas');
  return total;
}
