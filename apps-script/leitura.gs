/**
 * leitura.gs — Leitura inteligente de cupons, contas da casa e faturas de cartão.
 *
 * Ordem de tentativa:
 *  1. API do Claude (visão para fotos, documento para PDF) — chave em Script Properties
 *     `CHAVE_API_CLAUDE`, modelo em `MODELO_CLAUDE` (padrão claude-sonnet-4-5). Pede um JSON
 *     estrito com os campos de LeituraExtraida. Custo: centavos por cupom (uma foto comprimida
 *     tem ~1.500 tokens de entrada; a resposta, ~200 tokens).
 *  2. Sem chave ou em caso de falha: OCR do Drive (converte a imagem/PDF em Google Docs com
 *     `Drive.Files.insert(..., {ocr:true})`, serviço avançado Drive v2) + regex para valor total,
 *     data, CNPJ, linha digitável, kWh/m³.
 *  3. Texto de voz/SMS: regex local primeiro (sms.gs), Claude só quando a confiança é baixa.
 *  4. NFC-e: busca a página do QR na SEFAZ e extrai total/emitente/CNPJ/data por regex.
 *
 * Os arquivos são salvos no Drive na subpasta do tipo, em AAAA/MM, e o link vai em anexo_url.
 */

const URL_API_CLAUDE = 'https://api.anthropic.com/v1/messages';
const MODELO_CLAUDE_PADRAO = 'claude-sonnet-4-5';
const VERSAO_API_ANTHROPIC = '2023-06-01';
const MIMES_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ---------- Chamada ao Claude ----------

/** Há chave configurada? */
function claudeDisponivel() {
  return !!propriedade('CHAVE_API_CLAUDE', '');
}

/**
 * Chama o endpoint Messages com blocos de conteúdo (imagem/documento/texto) e devolve o texto.
 * Lança erro se não houver chave ou se a API falhar (quem chama decide o fallback).
 */
function chamarClaude(blocos, maxTokens, sistema) {
  const chave = propriedade('CHAVE_API_CLAUDE', '');
  if (!chave) throw new Error('CHAVE_API_CLAUDE não configurada');
  const corpo = {
    model: propriedade('MODELO_CLAUDE', MODELO_CLAUDE_PADRAO),
    max_tokens: maxTokens || 2048,
    system: sistema || 'Você é um assistente que lê documentos financeiros brasileiros e responde SOMENTE com JSON válido, sem comentários, sem markdown.',
    messages: [{ role: 'user', content: blocos }],
  };
  const resposta = UrlFetchApp.fetch(URL_API_CLAUDE, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': chave, 'anthropic-version': VERSAO_API_ANTHROPIC },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  const codigo = resposta.getResponseCode();
  const texto = resposta.getContentText();
  if (codigo !== 200) throw new Error('Claude respondeu ' + codigo + ': ' + texto.slice(0, 300));
  const json = JSON.parse(texto);
  if (json.stop_reason === 'refusal') throw new Error('Claude recusou a leitura deste documento');
  return (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

/** Bloco de conteúdo para imagem ou PDF em base64. */
function blocoArquivo(base64, mime) {
  if (mime === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  return { type: 'image', source: { type: 'base64', media_type: MIMES_IMAGEM.indexOf(mime) >= 0 ? mime : 'image/jpeg', data: base64 } };
}

/** Pega o primeiro objeto JSON de uma resposta (tolera texto em volta ou ```json). */
function extrairJson(texto) {
  const limpo = String(texto || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(limpo); } catch (e) { /* tenta recortar */ }
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini >= 0 && fim > ini) {
    try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch (e) { /* abaixo */ }
  }
  throw new Error('Resposta do Claude não é JSON');
}

/** Prompt em português conforme o tipo do documento. */
function promptLeitura(tipo, contasFixas) {
  const hoje = hojeIso();
  if (tipo === 'conta') {
    const lista = (contasFixas || []).map((c) => '- ' + c.id + ': ' + c.nome).join('\n');
    return 'Leia esta conta de consumo/boleto brasileiro e responda SOMENTE com um JSON com os campos:\n' +
      '{"empresa": string, "competencia": "AAAA-MM" (mês de referência), "vencimento": "AAAA-MM-DD", "valor": number (valor total a pagar, em reais),\n' +
      '"linha_digitavel": string (só dígitos e espaços, ou ""), "pix_copia_cola": string (código Pix "copia e cola" se houver, ou ""),\n' +
      '"consumo_valor": number ou null (kWh, m³ ou GB consumidos), "consumo_unidade": "kWh"|"m³"|"GB"|"",\n' +
      '"conta_fixa_id": string ou "" (escolha entre as contas cadastradas abaixo se for a mesma empresa), "confianca": number 0..1}\n' +
      'Contas cadastradas:\n' + (lista || '- (nenhuma)') + '\nHoje é ' + hoje + '. Use ponto como separador decimal. Não invente valores: se não souber, use null ou "".';
  }
  if (tipo === 'fatura_cartao') {
    return 'Leia esta fatura de cartão de crédito brasileira e liste TODAS as compras (não inclua pagamentos, estornos, juros nem o total).\n' +
      'Responda SOMENTE com JSON: {"compras": [{"data": "AAAA-MM-DD", "estabelecimento": string, "valor": number, "parcela": "n/m" ou null}], "confianca": number 0..1}.\n' +
      'Quando a fatura mostrar só dia/mês, deduza o ano pela data de vencimento. Hoje é ' + hoje + '. Use ponto como separador decimal.';
  }
  return 'Leia este cupom fiscal ou recibo brasileiro e responda SOMENTE com JSON:\n' +
    '{"valor": number (total pago), "data": "AAAA-MM-DD", "estabelecimento": string (nome fantasia), "cnpj": string ou "",\n' +
    '"forma_pgto": "dinheiro"|"pix"|"débito"|"crédito"|"boleto"|null, "itens": [{"nome": string, "valor": number}] (até 20 itens, ou []),\n' +
    '"descricao": string curta (ex.: "Compras no mercado"), "confianca": number 0..1}\n' +
    'Hoje é ' + hoje + '. Use ponto como separador decimal. Não invente valores: se não souber, use null.';
}

// ---------- Fallback: OCR do Drive + regex ----------

/** Extrai texto de imagem/PDF convertendo para Google Docs com OCR (precisa do serviço avançado Drive). */
function ocrDrive(blob) {
  if (typeof Drive === 'undefined' || !Drive.Files) throw new Error('Serviço avançado Drive não ativado (OCR indisponível)');
  const recurso = { title: 'ocr_temp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' };
  const arquivo = Drive.Files.insert(recurso, blob, { ocr: true, ocrLanguage: 'pt' });
  try {
    return DocumentApp.openById(arquivo.id).getBody().getText();
  } finally {
    try { Drive.Files.remove(arquivo.id); } catch (e) { DriveApp.getFileById(arquivo.id).setTrashed(true); }
  }
}

/** Regex sobre o texto do OCR (função pura). */
function extrairDeTextoOcr(texto, tipo) {
  const t = String(texto || '');
  const r = { confianca: 0.4, origem_leitura: 'ocr_drive' };
  const valores = [];
  const re = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
  let m;
  while ((m = re.exec(t)) !== null) valores.push(lerValor(m[1]));
  const total = t.match(/(?:VALOR\s+(?:TOTAL|A\s+PAGAR|DO\s+DOCUMENTO)|TOTAL(?:\s+R\$)?|TOTAL\s+A\s+PAGAR)\s*:?\s*(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (total) r.valor = lerValor(total[1]);
  else if (valores.length) r.valor = Math.max.apply(null, valores);
  const datas = t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
  const venc = t.match(/VENCIMENTO\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const cnpj = t.match(/CNPJ\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
  if (cnpj) r.cnpj = cnpj[1];
  const linha = t.match(/(\d{5}[.\s]?\d{5}\s?\d{5}[.\s]?\d{6}\s?\d{5}[.\s]?\d{6}\s?\d\s?\d{14})/) || t.match(/((?:\d{11}[\s.-]?\d[\s.-]?){4})/);
  if (linha) r.linha_digitavel = linha[1].replace(/[^\d]/g, ' ').replace(/\s+/g, ' ').trim();
  const kwh = t.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);
  const m3 = t.match(/(\d+(?:[.,]\d+)?)\s*m\s?[³3]\b/i);
  const gb = t.match(/(\d+(?:[.,]\d+)?)\s*GB\b/i);
  if (kwh) { r.consumo_valor = lerValor(kwh[1]); r.consumo_unidade = 'kWh'; }
  else if (m3) { r.consumo_valor = lerValor(m3[1]); r.consumo_unidade = 'm³'; }
  else if (gb) { r.consumo_valor = lerValor(gb[1]); r.consumo_unidade = 'GB'; }
  const pix = t.match(/(000201[0-9A-Za-z.\-*\s]{40,})/);
  if (pix) r.pix_copia_cola = pix[1].replace(/\s+/g, '');
  if (tipo === 'conta') {
    if (venc) r.vencimento = normalizarDataIso(venc[1]);
    else if (datas.length) r.vencimento = normalizarDataIso(datas[datas.length - 1]);
    const ref = t.match(/(?:REFER[ÊE]NCIA|M[ÊE]S\s+DE\s+REFER[ÊE]NCIA|COMPET[ÊE]NCIA)\s*:?\s*(\d{2})\/(\d{4})/i);
    r.competencia = ref ? ref[2] + '-' + ref[1] : (r.vencimento ? competenciaDe(r.vencimento) : competenciaDe());
    const primeiraLinha = t.split('\n').map((s) => s.trim()).filter((s) => s.length > 3)[0] || '';
    r.empresa = primeiraLinha.slice(0, 60);
  } else {
    if (datas.length) r.data = normalizarDataIso(datas[0]);
    const primeiraLinha = t.split('\n').map((s) => s.trim()).filter((s) => s.length > 3 && !/CNPJ|CUPOM|NOTA/i.test(s))[0] || '';
    r.estabelecimento = primeiraLinha.slice(0, 60);
    r.forma_pgto = extrairFormaPgto(t);
  }
  if (r.valor) r.confianca = 0.55;
  return semUndefined(r);
}

// ---------- Casamento com contas fixas e categorias ----------

/** Procura a conta fixa pelo id sugerido, pelo remetente/palavras-chave ou pelo nome da empresa. */
function casarContaFixa(leitura, textoExtra) {
  const contas = lerAba('ContasFixas').filter((c) => c.ativa);
  if (leitura.conta_fixa_id && contas.some((c) => c.id === leitura.conta_fixa_id)) return contas.find((c) => c.id === leitura.conta_fixa_id);
  const texto = normalizar([leitura.empresa, leitura.estabelecimento, textoExtra].filter(Boolean).join(' '));
  const categorias = lerAba('Categorias');
  let melhor = null, melhorPontos = 0;
  contas.forEach((c) => {
    let pontos = 0;
    const nomeNorm = normalizar(c.nome);
    nomeNorm.split(' ').filter((w) => w.length > 3).forEach((w) => { if (texto.indexOf(w) >= 0) pontos += 2; });
    const dominio = normalizar(String(c.remetente_email || '').split('@').pop().split('.')[0]);
    if (dominio && dominio.length > 3 && texto.indexOf(dominio) >= 0) pontos += 3;
    if (c.codigo_cliente && texto.indexOf(normalizar(c.codigo_cliente)) >= 0) pontos += 4;
    const cat = categorias.find((k) => k.id === c.categoria_id);
    if (cat) String(cat.palavras_chave || '').split(';').map(normalizar).filter(Boolean).forEach((pc) => { if (texto.indexOf(pc) >= 0) pontos += 2; });
    if (pontos > melhorPontos) { melhor = c; melhorPontos = pontos; }
  });
  return melhor;
}

/** Completa a leitura de uma conta com conta_fixa_id e categoria_id. */
function completarLeituraConta(leitura, textoExtra) {
  const conta = casarContaFixa(leitura, textoExtra);
  if (conta) { leitura.conta_fixa_id = conta.id; leitura.categoria_id = conta.categoria_id; if (!leitura.empresa) leitura.empresa = conta.nome; }
  else {
    const sug = sugerirCategoria([leitura.empresa, textoExtra].filter(Boolean).join(' '), lerAba('Categorias'));
    leitura.categoria_id = sug[0];
  }
  return leitura;
}

/** Completa a leitura de um cupom com a categoria sugerida. */
function completarLeituraCupom(leitura, ctx) {
  const texto = [leitura.estabelecimento, leitura.descricao].concat((leitura.itens || []).map((i) => i.nome)).filter(Boolean).join(' ');
  const sug = sugerirCategoria(texto, categoriasVisiveis(ctx));
  if (!leitura.categoria_id) leitura.categoria_id = sug[0];
  return leitura;
}

// ---------- Leitura de arquivo (foto/PDF) ----------

/** Pasta de destino por tipo. */
function pastaDoTipo(tipo) {
  if (tipo === 'conta') return 'Contas da Casa';
  if (tipo === 'fatura_cartao') return 'Faturas de Cartão';
  return 'Cupons e Recibos';
}

/** Salva o arquivo em <pasta do tipo>/AAAA/MM e devolve { id, url }. */
function salvarArquivoLeitura(blob, tipo, nome) {
  const comp = competenciaDe();
  const pasta = pastaPorCaminho(pastaDoTipo(tipo) + '/' + comp.slice(0, 4) + '/' + comp.slice(5, 7));
  const arquivo = pasta.createFile(blob.setName(nome));
  compartilharComLink(arquivo);
  return { id: arquivo.getId(), url: urlVisualizacao(arquivo.getId()) };
}

/** Nome de arquivo seguro: "cupom_2026-10-17_1430.jpg". */
function nomeArquivoLeitura(tipo, mime, nomeOriginal) {
  const ext = mime === 'application/pdf' ? 'pdf' : (mime || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
  const base = String(nomeOriginal || '').replace(/[^\w.\- ]/g, '').replace(/\.[^.]+$/, '').trim();
  const carimbo = agoraIso().replace(/[:T]/g, '-').slice(0, 16);
  return (base || tipo) + '_' + carimbo + '.' + ext;
}

/**
 * Lê um documento (cupom, conta ou fatura) tentando Claude e caindo para OCR+regex.
 * @returns LeituraExtraida (sem anexo_url; quem chama acrescenta)
 */
function lerDocumento(base64, mime, tipo, blob, ctx) {
  const contasFixas = tipo === 'conta' ? lerAba('ContasFixas').filter((c) => c.ativa) : [];
  let leitura = null;
  if (claudeDisponivel()) {
    try {
      const resposta = chamarClaude([blocoArquivo(base64, mime), { type: 'text', text: promptLeitura(tipo, contasFixas) }], tipo === 'fatura_cartao' ? 4096 : 1500);
      leitura = normalizarLeituraClaude(extrairJson(resposta), tipo);
      leitura.origem_leitura = 'claude';
    } catch (e) {
      console.warn('Leitura pelo Claude falhou, usando OCR: ' + e.message);
      leitura = null;
    }
  }
  let textoOcr = '';
  if (!leitura) {
    try {
      textoOcr = ocrDrive(blob);
      leitura = extrairDeTextoOcr(textoOcr, tipo);
      if (tipo === 'fatura_cartao') { leitura.compras = comprasDeTextoOcr(textoOcr); leitura.confianca = leitura.compras.length ? 0.4 : 0.1; }
    } catch (e) {
      console.warn('OCR do Drive indisponível: ' + e.message);
      leitura = { confianca: 0, origem_leitura: 'regex', aviso: 'Não consegui ler o arquivo automaticamente. Confira os dados à mão.' };
    }
  }
  if (tipo === 'conta') completarLeituraConta(leitura, textoOcr);
  else if (tipo === 'cupom') completarLeituraCupom(leitura, ctx);
  return leitura;
}

/** Normaliza tipos do JSON devolvido pelo Claude. */
function normalizarLeituraClaude(j, tipo) {
  const r = {};
  const num = (v) => (v === null || v === undefined || v === '' ? undefined : lerValor(v));
  const str = (v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined);
  if (tipo === 'fatura_cartao') {
    r.compras = (j.compras || []).map((c) => semUndefined({ data: normalizarDataIso(c.data), estabelecimento: str(c.estabelecimento) || '', valor: num(c.valor) || 0, parcela: str(c.parcela) })).filter((c) => c.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.data));
  } else if (tipo === 'conta') {
    r.empresa = str(j.empresa); r.competencia = str(j.competencia); r.vencimento = j.vencimento ? normalizarDataIso(j.vencimento) : undefined;
    r.valor = num(j.valor); r.linha_digitavel = str(j.linha_digitavel); r.pix_copia_cola = str(j.pix_copia_cola);
    r.consumo_valor = num(j.consumo_valor); r.consumo_unidade = str(j.consumo_unidade); r.conta_fixa_id = str(j.conta_fixa_id);
  } else {
    r.valor = num(j.valor); r.data = j.data ? normalizarDataIso(j.data) : undefined; r.estabelecimento = str(j.estabelecimento); r.cnpj = str(j.cnpj);
    r.forma_pgto = FORMAS_PGTO.indexOf(j.forma_pgto) >= 0 ? j.forma_pgto : undefined; r.descricao = str(j.descricao);
    r.itens = (j.itens || []).map((i) => ({ nome: String(i.nome || ''), valor: num(i.valor) || 0 })).slice(0, 30);
  }
  r.confianca = Math.max(0, Math.min(1, Number(j.confianca) || 0.8));
  return semUndefined(r);
}

/** Compras de uma fatura a partir do texto do OCR: linhas "dd/mm ESTABELECIMENTO 123,45". */
function comprasDeTextoOcr(texto) {
  const compras = [];
  const ano = new Date().getFullYear();
  String(texto || '').split('\n').forEach((linha) => {
    const m = linha.match(/^\s*(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);
    if (!m) return;
    const valor = lerValor(m[5]);
    if (!(valor > 0) || /PAGAMENTO|PGTO/i.test(m[4])) return;
    const a = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(ano);
    const parc = m[4].match(/\b(\d{1,2}\/\d{1,2})\b/);
    compras.push(semUndefined({ data: a + '-' + m[2] + '-' + m[1], estabelecimento: m[4].replace(/\b\d{1,2}\/\d{1,2}\b/, '').trim(), valor, parcela: parc ? parc[1] : undefined }));
  });
  return compras;
}

/** ler_imagem: salva o arquivo, lê e devolve LeituraExtraida com anexo_url. */
function acaoLerImagem(p, ctx) {
  const base64 = String(p.imagem_base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64) throw new ErroUsuario('Nenhuma imagem recebida.');
  const mime = String(p.mime || 'image/jpeg').toLowerCase();
  if (mime !== 'application/pdf' && MIMES_IMAGEM.indexOf(mime) < 0) throw new ErroUsuario('Formato não suportado. Envie JPG, PNG, WEBP ou PDF.');
  const tipo = ['cupom', 'conta', 'fatura_cartao'].indexOf(p.tipo) >= 0 ? p.tipo : 'cupom';
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, nomeArquivoLeitura(tipo, mime, p.nome_arquivo));
  const salvo = salvarArquivoLeitura(blob, tipo, blob.getName());
  const leitura = lerDocumento(base64, mime, tipo, blob, ctx);
  leitura.anexo_url = salvo.url;
  return leitura;
}

/** Usado por importar_fatura quando vem PDF/foto. */
function lerArquivoFatura(base64Bruto, mime, nomeOriginal, ctx) {
  const base64 = String(base64Bruto).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, nomeArquivoLeitura('fatura', mime, nomeOriginal));
  const salvo = salvarArquivoLeitura(blob, 'fatura_cartao', blob.getName());
  const leitura = lerDocumento(base64, mime, 'fatura_cartao', blob, ctx);
  leitura.anexo_url = salvo.url;
  return leitura;
}

/** Lê um blob já salvo (usado por email.gs e pela pasta _Entrada). */
function lerBlobComoConta(blob) {
  const base64 = Utilities.base64Encode(blob.getBytes());
  const mime = blob.getContentType() || 'application/pdf';
  return lerDocumento(base64, mime, 'conta', blob, { ehJunior: false, config: lerConfig() });
}

// ---------- Texto (voz / SMS) ----------

/** ler_texto: regex local; se a confiança for baixa e houver chave, pede ajuda ao Claude. */
function acaoLerTexto(p, ctx) {
  const texto = String(p.texto || '').trim();
  if (!texto) throw new ErroUsuario('Nenhum texto recebido.');
  const categorias = categoriasVisiveis(ctx);
  const local = extrairDeTexto(texto, categorias);
  if (local.confianca >= 0.7 || !claudeDisponivel()) return local;
  try {
    const lista = categorias.map((c) => c.id + ' (' + c.nome + ')').join(', ');
    const prompt = 'Frase dita por um membro da família sobre um gasto ou receita: "' + texto.replace(/"/g, "'") + '".\n' +
      'Responda SOMENTE com JSON: {"valor": number ou null, "data": "AAAA-MM-DD" ou null, "descricao": string, "estabelecimento": string ou null,\n' +
      '"forma_pgto": "dinheiro"|"pix"|"débito"|"crédito"|"boleto"|null, "categoria_id": um destes ids: ' + lista + ', "confianca": 0..1}.\n' +
      'Hoje é ' + hojeIso() + '. Se a data não for dita, use hoje.';
    const j = extrairJson(chamarClaude([{ type: 'text', text: prompt }], 400));
    const r = semUndefined({
      valor: j.valor === null || j.valor === undefined ? local.valor : lerValor(j.valor),
      data: j.data ? normalizarDataIso(j.data) : local.data,
      descricao: j.descricao || local.descricao,
      estabelecimento: j.estabelecimento || local.estabelecimento,
      forma_pgto: FORMAS_PGTO.indexOf(j.forma_pgto) >= 0 ? j.forma_pgto : local.forma_pgto,
      categoria_id: categorias.some((c) => c.id === j.categoria_id) ? j.categoria_id : local.categoria_id,
      confianca: Math.max(local.confianca, Math.min(1, Number(j.confianca) || 0.6)),
      origem_leitura: 'claude',
    });
    return r;
  } catch (e) {
    console.warn('ler_texto: Claude falhou, devolvendo leitura local: ' + e.message);
    return local;
  }
}

// ---------- NFC-e (QR do cupom) ----------

/** consultar_nfce: busca a página do QR e extrai os dados. Se a SEFAZ bloquear, confiança 0. */
function acaoConsultarNfce(p, ctx) {
  const url = String(p.url_qr || '').trim();
  if (!/^https?:\/\//i.test(url) || !/fazenda|sefaz|nfce|nfe/i.test(url)) throw new ErroUsuario('Este QR não parece ser de uma NFC-e.');
  let html = '';
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (FinancasFamilia)' } });
    if (resp.getResponseCode() === 200) html = resp.getContentText();
  } catch (e) { html = ''; }
  const dados = extrairDadosNfce(html);
  if (!dados.valor) {
    return { confianca: 0, origem_leitura: 'nfce', aviso: 'A SEFAZ não devolveu os dados do cupom (pode exigir captcha). Tire uma foto do cupom ou digite o valor.' };
  }
  const sug = sugerirCategoria(dados.estabelecimento || '', categoriasVisiveis(ctx));
  return Object.assign(dados, { categoria_id: sug[0], confianca: 0.95, origem_leitura: 'nfce' });
}

/** Regex sobre o HTML da consulta pública (função pura; layouts variam por estado). */
function extrairDadosNfce(html) {
  const h = String(html || '');
  const texto = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const r = {};
  const total = texto.match(/Valor\s+a\s+pagar\s*(?:R\$)?\s*:?\s*([\d.]+,\d{2})/i) || texto.match(/Valor\s+total\s*(?:R\$)?\s*:?\s*([\d.]+,\d{2})/i) || h.match(/class="totalNumb txtMax"[^>]*>\s*([\d.]+,\d{2})/i);
  if (total) r.valor = lerValor(total[1]);
  const emit = h.match(/id="u20"[^>]*>([^<]+)</i) || h.match(/class="txtTopo"[^>]*>([^<]+)</i) || texto.match(/(?:Raz[ãa]o\s+Social|Nome\s*\/\s*Raz[ãa]o\s+Social)\s*:?\s*([^:]{3,80}?)\s+CNPJ/i);
  if (emit) r.estabelecimento = emit[1].trim();
  const cnpj = texto.match(/CNPJ\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
  if (cnpj) r.cnpj = cnpj[1];
  const data = texto.match(/Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i) || texto.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/);
  if (data) r.data = normalizarDataIso(data[1]);
  const forma = texto.match(/(Cart[ãa]o\s+de\s+(?:Cr[ée]dito|D[ée]bito)|Dinheiro|PIX|Pagamento\s+Instant[âa]neo)/i);
  if (forma) r.forma_pgto = extrairFormaPgto(forma[1]) || (/instant/i.test(forma[1]) ? 'pix' : undefined);
  return semUndefined(r);
}
