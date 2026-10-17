/**
 * sms.gs — Captura automática de compras no cartão e Caixa de Entrada.
 *
 * Parte 1 (funções PURAS, testáveis fora do Apps Script — ver testes/executar.mjs):
 *  - PADROES_BANCO: regex por banco (porte de app/src/util/extrator.ts, mesmos padrões);
 *  - lerSms(texto): descarta OTP/propaganda/estorno e extrai valor, estabelecimento, final do cartão;
 *  - extrairValor / extrairData / extrairFormaPgto / extrairDeTexto (frase ditada);
 *  - lerFaturaTexto(texto): OFX ou CSV → lista de compras.
 *
 * Parte 2 (toca a planilha):
 *  - tratarWebhook(p): `?webhook=1` — valida tokens, identifica o membro pelo token e pelo final
 *    do cartão (aba Cartoes), calcula hash_dedup, checa duplicidade (±2 dias, mesmo valor) e
 *    grava na CaixaEntrada com até 6 sugestões de categoria;
 *  - listar/resolver caixa de entrada, importar/confirmar fatura, cartões (só 4 últimos dígitos).
 *
 * Segurança: nunca gravamos código de verificação, senha ou número completo de cartão.
 */

// =====================================================================
// PARTE 1 — FUNÇÕES PURAS
// =====================================================================

/** Padrões de SMS/alerta por banco. Para ampliar, basta acrescentar uma linha. */
const PADROES_BANCO = [
  // Itaú: "Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12"
  { banco: 'Itaú', regex: /ITA[UÚ].*?final\s*(\d{4}).*?R\$\s*([\d.]+,\d{2})\s*(?:em|no|na)\s+(.+?)(?:\s+em\s+\d{1,2}\/\d{1,2}|\s+as\s+\d|,|\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Nubank: "Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765"
  { banco: 'Nubank', regex: /Compra\s+de\s+R\$\s*([\d.]+,\d{2})\s+APROVADA\s+em\s+(.+?)\s+(?:com|no)\b.*?final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Bradesco: "BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 17/10 10:00 NO VALOR DE R$ 50,00 EM MERCADO X"
  { banco: 'Bradesco', regex: /BRADESCO.*?FINAL\s*(\d{4}).*?VALOR\s+DE\s+R\$\s*([\d.]+,\d{2})\s+EM\s+(.+?)(?:\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Santander: "Santander: compra aprovada cartao final 1234 R$ 50,00 MERCADO X 17/10 10:00"
  { banco: 'Santander', regex: /SANTANDER.*?final\s*(\d{4})\s*R\$\s*([\d.]+,\d{2})\s+(.+?)\s+\d{1,2}\/\d{1,2}/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Banco do Brasil: "BB: Compra aprovada R$ 50,00 em MERCADO X cartao final 1234 17/10 10:00"
  { banco: 'Banco do Brasil', regex: /\bBB\b.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Caixa: "CAIXA: Compra aprovada no cartao final 1234, R$ 50,00, MERCADO X, 17/10"
  { banco: 'Caixa', regex: /CAIXA.*?final\s*(\d{4}),?\s*R\$\s*([\d.]+,\d{2}),?\s*(.+?),/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Inter: "Inter: compra aprovada de R$ 50,00 em MERCADO X no cartao final 1234"
  { banco: 'Inter', regex: /INTER.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+no\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // C6: "C6 Bank: Compra aprovada R$ 50,00 MERCADO X final 1234"
  { banco: 'C6', regex: /C6.*?R\$\s*([\d.]+,\d{2})\s+(.+?)\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // BV / Ailos / cooperativas e genérico: "... R$ 50,00 ... em MERCADO X ... final 1234"
  { banco: 'Genérico', regex: /R\$\s*([\d.]+,\d{2})\s+(?:em|no|na|-)\s+(.+?)(?:\s+(?:com|no|cart[aã]o|final|em\s+\d|as\s+\d|,|\.|$))/i, grupos: { valor: 1, estabelecimento: 2 } },
];

/** Mensagens que NÃO são compra: códigos, senhas, propaganda, avisos. Nunca entram na planilha. */
const IGNORAR_SMS = /c[oó]digo|senha|token|verifica[cç][aã]o|OTP|n[aã]o compartilhe|promo[cç][aã]o|oferta especial|desconto|cashback|clique|acesse|fatura fechada|pagamento recebido|limite dispon/i;

const NUMEROS_POR_EXTENSO = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000,
};

/** Lê um valor em reais de uma frase: "45 reais", "R$ 45,90", "quarenta e cinco reais", "45 e 50". */
function extrairValor(texto) {
  const t = String(texto || '').toLowerCase();
  const m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[,.]\d{1,2}|\d+)(?:\s*(?:reais|real|conto|pila|pau)?(?:\s*e\s*(\d{1,2})\s*(?:centavos)?)?)/);
  if (m && (t.indexOf('r$') >= 0 || /reais|real|conto|pila|pau|centavos|gastei|paguei|custou|foi|deu|de\s+\d/.test(t) || /\d[,.]\d{2}/.test(m[1]))) {
    let v = m[1];
    if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.');
    let n = parseFloat(v);
    if (m[2] && m[1].indexOf(',') < 0 && m[1].indexOf('.') < 0) n += parseInt(m[2], 10) / 100;
    if (!isNaN(n)) return Math.round(n * 100) / 100;
  }
  // Por extenso simples: "quarenta e cinco reais", "cento e vinte"
  const palavras = t.replace(/[^a-zà-ú\s]/g, ' ').split(/\s+/);
  let total = 0, achou = false, acumulado = 0;
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i];
    if (Object.prototype.hasOwnProperty.call(NUMEROS_POR_EXTENSO, p)) {
      const n = NUMEROS_POR_EXTENSO[p];
      if (n === 1000) { acumulado = (acumulado || 1) * 1000; total += acumulado; acumulado = 0; } else acumulado += n;
      achou = true;
    } else if (p !== 'e' && achou) {
      total += acumulado;
      acumulado = 0;
      if (/reais|real|conto|pila/.test(p)) break;
    }
  }
  total += acumulado;
  return achou && total > 0 ? total : undefined;
}

/** Forma de pagamento citada no texto. */
function extrairFormaPgto(texto) {
  const t = normalizar(texto);
  if (/\bPIX\b/.test(t)) return 'pix';
  if (/DEBITO/.test(t)) return 'débito';
  if (/CREDITO|CARTAO|PARCEL/.test(t)) return 'crédito';
  if (/DINHEIRO|ESPECIE/.test(t)) return 'dinheiro';
  if (/BOLETO/.test(t)) return 'boleto';
  return undefined;
}

/** Data relativa: hoje, ontem, anteontem, "dia 12", "12/03". */
function extrairData(texto) {
  const t = normalizar(texto);
  const hoje = new Date();
  if (/ANTEONTEM/.test(t)) return dataParaIso(new Date(hoje.getTime() - 2 * 86400000));
  if (/ONTEM/.test(t)) return dataParaIso(new Date(hoje.getTime() - 86400000));
  const m = String(texto || '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear();
    return ano + '-' + zeros(m[2]) + '-' + zeros(m[1]);
  }
  const d = t.match(/\bDIA (\d{1,2})\b/);
  if (d) return hoje.getFullYear() + '-' + zeros(hoje.getMonth() + 1) + '-' + zeros(d[1]);
  return dataParaIso(hoje);
}

/**
 * Lê um SMS/alerta de banco.
 * @returns {{valido:boolean, motivo?:string, banco?:string, valor?:number, estabelecimento?:string, final_cartao?:string, parcelas?:string, data?:string}}
 */
function lerSms(texto) {
  const s = String(texto || '');
  if (!s || s.length < 10) return { valido: false, motivo: 'Mensagem vazia' };
  if (IGNORAR_SMS.test(s) && !/compra/i.test(s)) return { valido: false, motivo: 'Não é uma compra (código, promoção ou aviso)' };
  if (/estorno|cancelad/i.test(s)) return { valido: false, motivo: 'Estorno/cancelamento — ignorado' };
  for (let i = 0; i < PADROES_BANCO.length; i++) {
    const padrao = PADROES_BANCO[i];
    const m = s.match(padrao.regex);
    if (!m) continue;
    const valor = parseFloat(m[padrao.grupos.valor].replace(/\./g, '').replace(',', '.'));
    const estabelecimento = m[padrao.grupos.estabelecimento].trim().replace(/\s+/g, ' ');
    const finalGeral = s.match(/final\s*(\d{4})/i);
    const final_cartao = padrao.grupos.final ? m[padrao.grupos.final] : (finalGeral ? finalGeral[1] : '');
    const parc = s.match(/(\d{1,2})\s*[xX]\b|em\s+(\d{1,2})\s*(?:vezes|parcelas)/);
    const parcelas = parc ? '1/' + (parc[1] || parc[2]) : undefined;
    if (!valor || !estabelecimento) continue;
    return { valido: true, banco: padrao.banco, valor, estabelecimento, final_cartao, parcelas, data: extrairData(s) };
  }
  return { valido: false, motivo: 'Não reconhecemos o formato deste banco' };
}

/** Frase ditada (ou SMS) → LeituraExtraida, usando as categorias para sugerir. */
function extrairDeTexto(texto, categorias) {
  const sms = lerSms(texto);
  if (sms.valido) {
    const sug = sugerirCategoria(sms.estabelecimento || '', categorias);
    return { valor: sms.valor, data: sms.data, estabelecimento: sms.estabelecimento, descricao: sms.estabelecimento, forma_pgto: 'crédito', categoria_id: sug[0], confianca: 0.8, origem_leitura: 'regex' };
  }
  const valor = extrairValor(texto);
  const ehReceita = /recebi|entrou|ganhei|salario|salário|pagaram/i.test(texto);
  const sug = sugerirCategoria(texto, categorias, ehReceita ? 'receita' : 'despesa');
  let descricao = String(texto || '')
    .replace(/r\$\s*[\d.,]+|\b\d+[.,]?\d*\s*(reais|real|conto|pila|centavos)?\b/gi, ' ')
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|no pix|pix|d[ée]bito|cr[ée]dito|dinheiro|boleto|cart[aã]o|hoje|ontem|anteontem|de|da|do|na|no|em|com|e|um|uma|o|a)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (descricao) descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  return semUndefined({
    valor, data: extrairData(texto), descricao: descricao || undefined, estabelecimento: descricao || undefined,
    forma_pgto: extrairFormaPgto(texto), categoria_id: sug[0],
    confianca: valor ? 0.7 : 0.3, origem_leitura: 'regex',
  });
}

/** Texto do SMS que vai para a planilha: mascara sequências longas de dígitos (por segurança). */
function sanitizarTextoSms(texto) {
  return String(texto || '').replace(/\b\d{5,}\b/g, '•••••').slice(0, 300);
}

/** Data OFX "20261017120000[-3:BRT]" → ISO. */
function dataOfxParaIso(s) {
  const m = String(s || '').match(/(\d{4})(\d{2})(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/**
 * Lê uma fatura em texto: OFX (<STMTTRN>) ou CSV/TSV (data;estabelecimento;valor[;parcela]).
 * Devolve [{data, estabelecimento, valor, parcela?}] só com valores positivos (compras).
 */
function lerFaturaTexto(texto) {
  const t = String(texto || '');
  const compras = [];
  if (/<STMTTRN>/i.test(t)) {
    const blocos = t.split(/<STMTTRN>/i).slice(1);
    blocos.forEach((b) => {
      const pega = (tag) => { const m = b.match(new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const valor = Math.abs(lerValor(pega('TRNAMT').replace(',', '.')));
      const tipo = pega('TRNTYPE').toUpperCase();
      const est = pega('MEMO') || pega('NAME');
      // Pagamento da fatura (crédito) não é compra.
      if (!valor || (tipo === 'CREDIT' && /PAGAMENTO|PGTO|PAGTO/i.test(est))) return;
      const parc = est.match(/(\d{1,2})\/(\d{1,2})/);
      compras.push(semUndefined({ data: dataOfxParaIso(pega('DTPOSTED')), estabelecimento: est.replace(/\s+/g, ' '), valor, parcela: parc ? parc[0] : undefined }));
    });
    return compras;
  }
  t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((linha) => {
    if (/^data[;,\t]/i.test(linha)) return; // cabeçalho
    // Separador: ";" ou tabulação; vírgula só quando não há outro (para não quebrar "312,50").
    const sep = linha.indexOf(';') >= 0 ? ';' : (linha.indexOf('\t') >= 0 ? '\t' : ',');
    const partes = linha.split(sep).map((s) => s.replace(/^"|"$/g, '').trim());
    if (partes.length < 3) return;
    const data = normalizarDataIso(partes[0]);
    const valor = lerValor(partes[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !(valor > 0)) return;
    const parc = (partes[3] || '').match(/\d{1,2}\/\d{1,2}/) || partes[1].match(/\b(\d{1,2}\/\d{1,2})\b/);
    compras.push(semUndefined({ data, estabelecimento: partes[1], valor, parcela: parc ? parc[0] : undefined }));
  });
  return compras;
}

/**
 * Verifica se uma compra já existe (função pura): mesmo valor e até ±2 dias de diferença,
 * e (mesmo cartão ou mesma primeira palavra do estabelecimento) — ou mesmo hash_dedup.
 */
function compraJaExiste(compra, lancamentos, itensCaixa, finalCartao, cartaoId) {
  const hash = hashDedup(compra.valor, compra.data, finalCartao || '', compra.estabelecimento || '');
  const primeira = normalizar(compra.estabelecimento).split(' ')[0];
  const mesmoValorEData = (valor, data) => Math.abs(valor - compra.valor) < 0.005 && Math.abs(diferencaDias(data, compra.data)) <= 2;
  const emLanc = (lancamentos || []).some((l) => l.hash_dedup === hash || (mesmoValorEData(l.valor, l.data) && (
    (cartaoId && l.cartao_id === cartaoId) || (primeira && normalizar(l.estabelecimento).split(' ')[0] === primeira)
  )));
  if (emLanc) return true;
  return (itensCaixa || []).some((c) => c.status !== 'ignorado' && (c.hash_dedup === hash || (mesmoValorEData(c.valor, c.data_compra) && (!finalCartao || c.final_cartao === finalCartao))));
}

// =====================================================================
// PARTE 2 — WEBHOOK, CAIXA DE ENTRADA, FATURAS E CARTÕES (tocam a planilha)
// =====================================================================

const CANAIS_VALIDOS = ['sms_ios', 'sms_android', 'email', 'fatura'];

/**
 * Webhook `?webhook=1` (GET ou POST). Devolve { status: 'pendente'|'duplicado'|'ignorado', item }.
 * Tokens inválidos geram erro ("Família não encontrada" / "Sessão expirada").
 */
function tratarWebhook(p) {
  validarTokenFamilia(p.token_familia);
  const usuario = usuarioPorToken(String(p.token || ''));
  if (!usuario || !usuario.ativo) throw new ErroUsuario('Sessão expirada');
  const canal = CANAIS_VALIDOS.indexOf(p.canal) >= 0 ? p.canal : 'sms_android';
  return registrarAlertaNaCaixa(String(p.texto || ''), canal, usuario);
}

/**
 * Lê o alerta, identifica o membro (titular do cartão pelo final, senão quem enviou),
 * checa duplicidade e grava na CaixaEntrada.
 */
function registrarAlertaNaCaixa(texto, canal, usuario) {
  const leitura = lerSms(texto);
  if (!leitura.valido) return { status: 'ignorado', item: null, motivo: leitura.motivo };

  const cartoes = lerAba('Cartoes').filter((k) => k.ativo);
  const cartao = leitura.final_cartao ? cartoes.find((k) => apenasFinalCartao(k.final) === leitura.final_cartao) : null;
  const uid = cartao && cartao.titular_id ? cartao.titular_id : (usuario ? usuario.id : '');
  const compra = { valor: leitura.valor, data: leitura.data, estabelecimento: leitura.estabelecimento };
  const duplicado = compraJaExiste(compra, lancamentosAtivos(), lerAba('CaixaEntrada'), leitura.final_cartao, cartao ? cartao.id : '');
  const sugestoes = sugerirCategoria(leitura.estabelecimento, lerAba('Categorias'));
  const item = {
    id: gerarId('ce'), recebido_em: agoraIso(), canal, texto_bruto: sanitizarTextoSms(texto),
    valor: leitura.valor, estabelecimento: leitura.estabelecimento, final_cartao: leitura.final_cartao || '',
    data_compra: leitura.data, sugestao_categoria: sugestoes[0] || 'c_imprevistos', sugestoes,
    usuario_id: uid, status: duplicado ? 'duplicado' : 'pendente', lancamento_id: '',
    hash_dedup: hashDedup(leitura.valor, leitura.data, leitura.final_cartao || '', leitura.estabelecimento),
  };
  inserirLinhas('CaixaEntrada', [item]);
  if (!duplicado) {
    try { notificarNovaCompra(item); } catch (e) { console.warn('Falha ao notificar nova compra: ' + e.message); }
  }
  return { status: item.status, item: itemCaixaPublico(item) };
}

/** Item da caixa de entrada para o app (sem hash interno). */
function itemCaixaPublico(c) {
  const o = Object.assign({}, c);
  delete o.hash_dedup;
  o.sugestoes = Array.isArray(o.sugestoes) ? o.sugestoes : String(o.sugestoes || '').split(';').filter(Boolean);
  return o;
}

/** listar_caixa_entrada: Júnior só vê os próprios itens. */
function acaoListarCaixaEntrada(p, ctx) {
  let itens = lerAba('CaixaEntrada');
  if (ctx.ehJunior) itens = itens.filter((c) => c.usuario_id === ctx.uid);
  if (p.status) itens = itens.filter((c) => c.status === p.status);
  return itens.slice().sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1)).map(itemCaixaPublico);
}

/** resolver_caixa_entrada: 'lancar' cria o lançamento (crédito no cartão do final) ou 'ignorar'. */
function acaoResolverCaixaEntrada(p, ctx) {
  const c = buscarPorId('CaixaEntrada', String(p.id || ''));
  if (!c) throw new ErroUsuario('Item não encontrado');
  if (ctx.ehJunior && c.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  if (c.status === 'lançado') throw new ErroUsuario('Este item já foi lançado.');
  if (p.acao_caixa === 'ignorar') return itemCaixaPublico(atualizarPorId('CaixaEntrada', c.id, { status: 'ignorado' }));

  const cartao = lerAba('Cartoes').find((k) => apenasFinalCartao(k.final) === c.final_cartao);
  const categoriaId = p.categoria_id || c.sugestao_categoria || 'c_imprevistos';
  if (ctx.ehJunior) {
    const cat = buscarPorId('Categorias', categoriaId);
    if (cat && cat.sensivel && !juniorVeSensivel(ctx)) throw new ErroUsuario('Sem permissão');
  }
  const data = c.data_compra || hojeIso();
  const l = inserirLinhas('Lancamentos', [{
    id: gerarId('l'), data, competencia: competenciaDe(data), tipo: 'despesa', valor: c.valor, categoria_id: categoriaId,
    descricao: p.descricao || c.estabelecimento, estabelecimento: c.estabelecimento, forma_pgto: 'crédito', cartao_id: cartao ? cartao.id : '',
    parcela: '', usuario_id: c.usuario_id || ctx.uid, origem: c.canal === 'email' ? 'email' : c.canal === 'fatura' ? 'fatura' : 'sms',
    anexo_url: '', status: 'confirmado', hash_dedup: hashDedup(c.valor, data, c.final_cartao, c.estabelecimento),
    criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
  }])[0];
  return itemCaixaPublico(atualizarPorId('CaixaEntrada', c.id, { status: 'lançado', lancamento_id: l.id }));
}

/**
 * importar_fatura (Adulto): PDF/imagem via Claude ou texto OFX/CSV via parser próprio.
 * Devolve LeituraExtraida com compras[] e ja_lancada (conciliação ±2 dias, mesmo valor).
 */
function acaoImportarFatura(p, ctx) {
  const cartao = buscarPorId('Cartoes', String(p.cartao_id || ''));
  if (!cartao) throw new ErroUsuario('Escolha o cartão da fatura.');
  let compras = [];
  let origem = 'regex';
  let confianca = 0.9;
  let anexoUrl = '';
  if (p.imagem_base64) {
    const leitura = lerArquivoFatura(p.imagem_base64, p.mime || 'application/pdf', p.nome_arquivo || '', ctx);
    compras = leitura.compras || [];
    origem = leitura.origem_leitura;
    confianca = leitura.confianca;
    anexoUrl = leitura.anexo_url || '';
  } else if (p.texto) {
    compras = lerFaturaTexto(p.texto);
    if (!compras.length) throw new ErroUsuario('Não encontrei compras nesse arquivo. Envie um OFX ou CSV (data;estabelecimento;valor).');
  } else {
    throw new ErroUsuario('Envie o PDF/foto da fatura ou o arquivo OFX/CSV.');
  }
  const lancs = lancamentosAtivos();
  const caixa = lerAba('CaixaEntrada');
  const conciliadas = compras.map((c) => Object.assign({}, c, { ja_lancada: compraJaExiste(c, lancs, caixa, apenasFinalCartao(cartao.final), cartao.id) }));
  return semUndefined({ compras: conciliadas, confianca, origem_leitura: origem, anexo_url: anexoUrl || undefined });
}

/** confirmar_importacao: cria itens pendentes na CaixaEntrada para as compras escolhidas. */
function acaoConfirmarImportacao(p, ctx) {
  const cartao = buscarPorId('Cartoes', String(p.cartao_id || ''));
  if (!cartao) throw new ErroUsuario('Cartão não encontrado');
  const categorias = lerAba('Categorias');
  const final = apenasFinalCartao(cartao.final);
  const itens = (p.compras || []).filter((c) => c && lerValor(c.valor) > 0).map((c) => {
    const data = normalizarDataIso(c.data) || hojeIso();
    const sug = sugerirCategoria(c.estabelecimento || '', categorias);
    return {
      id: gerarId('ce'), recebido_em: agoraIso(), canal: 'fatura', texto_bruto: (data + ' ' + (c.estabelecimento || '') + ' ' + lerValor(c.valor) + (c.parcela ? ' ' + c.parcela : '')).slice(0, 300),
      valor: lerValor(c.valor), estabelecimento: String(c.estabelecimento || '').trim(), final_cartao: final, data_compra: data,
      sugestao_categoria: sug[0] || 'c_imprevistos', sugestoes: sug, usuario_id: cartao.titular_id || ctx.uid, status: 'pendente', lancamento_id: '',
      hash_dedup: hashDedup(lerValor(c.valor), data, final, c.estabelecimento || ''),
    };
  });
  if (!itens.length) return [];
  return inserirLinhas('CaixaEntrada', itens).map(itemCaixaPublico);
}

// ---------- Cartões ----------

/** Garante que só os 4 últimos dígitos saem do servidor. */
function cartaoPublico(k) {
  return Object.assign({}, k, { final: apenasFinalCartao(k.final), ativo: !!k.ativo });
}

function acaoListarCartoes() {
  return lerAba('Cartoes').map(cartaoPublico);
}

/** salvar_cartao (Administrador): trunca sempre para 4 dígitos antes de gravar. */
function acaoSalvarCartao(p) {
  const k = p.cartao || {};
  const final = apenasFinalCartao(k.final);
  if (final.length !== 4) throw new ErroUsuario('Informe só os 4 últimos dígitos do cartão.');
  if (!k.apelido) throw new ErroUsuario('Dê um apelido ao cartão (ex.: "Nubank da Mãe").');
  const novo = {
    id: k.id || gerarId('k'), apelido: k.apelido, banco: k.banco || '', final, titular_id: k.titular_id || '',
    dia_fechamento: Number(k.dia_fechamento) || 1, dia_vencimento: Number(k.dia_vencimento) || 10,
    cor: k.cor || '#5B5BE0', ativo: k.ativo === undefined ? true : paraBooleano(k.ativo),
  };
  return cartaoPublico(salvarPorId('Cartoes', novo));
}
