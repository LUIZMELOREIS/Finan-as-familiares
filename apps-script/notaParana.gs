/**
 * notaParana.gs — Leitor do Nota Paraná (NFC-e e NF-e com CPF na nota, qualquer cidade do PR).
 *
 * Especificação: docs/ROBO_NOTAS_FISCAIS.md (seções 1, 2 e 10). Depende dos ajudantes de rede,
 * cookies e credenciais de notasFiscais.gs.
 *
 *  - Fase 0: `testeLoginNotaParana()` — prova de conceito do login pelo UrlFetchApp (imprime só
 *    "login ok · N notas em MM/AAAA" ou o motivo da falha).
 *  - Fase 1: `loginNotaParana()`, `listarMesNotaParana()`, `lerDanfeNotaParana()` e os parsers PUROS
 *    `extrairListaNotasPr(html)` e `extrairDanfePr(html)`, testados em testes/executar.mjs com as
 *    amostras anonimizadas de testes/amostras/.
 *
 * Regra de ouro: CPF, senha, cookies, tokens e códigos do OAuth NUNCA vão para log, planilha, Git ou
 * mensagem. Os cookies vivem apenas na memória desta execução.
 */

// ---------- Endereços ----------

/** Aplicação do Nota Paraná (a lista e o DANFE ficam aqui, atrás do login). */
const NOTAPR_URL_BASE = 'https://notaparana.pr.gov.br';
const NOTAPR_URL_ENTRADA = NOTAPR_URL_BASE + '/nfprweb/Extrato';
const NOTAPR_URL_LISTA = NOTAPR_URL_BASE + '/nfprweb/NotasFiscaisAjax';
const NOTAPR_URL_DANFE = NOTAPR_URL_BASE + '/nfprweb/NotaFiscalHtml';
/** Identidade Digital Sefa/PR (OAuth authorization code + PKCE; o formulário é authentication.jsp). */
const SEFA_AUTHZ_HOST = 'authz-sefa.identidadedigital.pr.gov.br';

// ---------- Funções puras: formulário da Sefa ----------

/**
 * Parâmetros da query string, **sem decodificar** (é assim que authentication.jsp copia cada par
 * `chave=valor` para os campos ocultos do formulário, e o navegador codifica de novo ao enviar).
 */
function lerQueryString(url) {
  const q = String(url || '').split('#')[0].split('?')[1] || '';
  const saida = {};
  q.split('&').forEach(function (par) {
    if (!par) return;
    const i = par.indexOf('=');
    const chave = i < 0 ? par : par.slice(0, i);
    const valor = i < 0 ? '' : par.slice(i + 1);
    if (chave) saida[chave] = valor;
  });
  return saida;
}

/** Campos que o formulário da Sefa envia em `POST api/v1/authorize`: step=2 + todos os parâmetros da URL. */
function camposDoFormularioSefa(urlAuthentication) {
  const campos = lerQueryString(urlAuthentication);
  campos.step = '2';
  return campos;
}

/** É a página de login da Identidade Digital Sefa? (pela URL ou pelo HTML) */
function ehPaginaLoginSefa(url, html) {
  return /authentication\.jsp/i.test(String(url || '')) || /id="authForm"/i.test(String(html || ''));
}

/** Período como o portal espera: `01/MM/AAAA`. */
function periodoNotaPr(ano, mes) {
  return '01/' + zeros(mes, 2) + '/' + ano;
}

// ---------- Funções puras: lista do mês ----------

/**
 * Ids das notas (`idDocFiscal`) na lista do mês do Nota Paraná (`NotasFiscaisAjax`), sem repetição.
 * Também aceita um JSON com objetos que tenham `idDocFiscal`, caso o portal passe a devolver JSON.
 */
function extrairIdsNotasPr(html) {
  const texto = String(html || '');
  const vistos = {};
  const ids = [];
  const re = /idDocFiscal["']?\s*[=:]\s*["']?(\d+)/gi;
  let m;
  while ((m = re.exec(texto))) {
    if (!vistos[m[1]]) { vistos[m[1]] = true; ids.push(m[1]); }
  }
  return ids;
}

/** Quantas notas há na lista do mês (prova de conceito: só a contagem). */
function contarNotasPr(html) {
  return extrairIdsNotasPr(html).length;
}

/**
 * Lista do mês → [{ id_portal, tp_doc, cnpj, emitente, numero, data_emissao, valor, credito, situacao }].
 * Colunas vistas no portal: CNPJ · Estabelecimento · Nota (link) · Data de emissão · Valor · Crédito · Situação.
 * Tolerante: localiza CNPJ, data e valores pelo formato, e o link pelo `idDocFiscal`. Uma nota repetida
 * (duas linhas com o mesmo id) entra uma vez só.
 */
function extrairListaNotasPr(html) {
  const texto = String(html || '');
  const saida = [];
  const vistos = {};
  const linhas = texto.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  linhas.forEach(function (tr) {
    const link = tr.match(/tpDoc=(\d)[^"'>]*?idDocFiscal=(\d+)|idDocFiscal=(\d+)[^"'>]*?tpDoc=(\d)/i);
    if (!link) return;
    const id = link[2] || link[3];
    const tp = link[1] || link[4];
    if (!id || vistos[id]) return;
    vistos[id] = true;
    const celulas = (tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || []).map(function (td) { return limparHtml(td); });
    const cnpj = (tr.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || [''])[0];
    const data = (tr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2})(?::\d{2})?)?/) || null);
    const valores = [];
    celulas.forEach(function (c) { const v = c.match(/^(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})$/); if (v) valores.push(lerValor(v[1])); });
    const numero = limparHtml((tr.match(/idDocFiscal=\d+[^>]*>([\s\S]*?)<\/a>/i) || ['', ''])[1]).replace(/\D/g, '');
    const idxCnpj = celulas.findIndex(function (c) { return c === cnpj; });
    const emitente = idxCnpj >= 0 && celulas[idxCnpj + 1] ? celulas[idxCnpj + 1] : (celulas.find(function (c) { return /[A-Za-z]{3}/.test(c) && !/^R\$/.test(c) && c !== cnpj && !/^\d{2}\/\d{2}\/\d{4}/.test(c); }) || '');
    const ultima = celulas.length ? celulas[celulas.length - 1] : '';
    saida.push({
      id_portal: id, tp_doc: tp === '1' ? '1' : '2', cnpj: cnpjSoDigitos(cnpj), emitente: emitente, numero: numero,
      data_emissao: data ? data[3] + '-' + data[2] + '-' + data[1] + (data[4] ? ' ' + data[4] : '') : '',
      valor: valores.length ? valores[0] : 0, credito: valores.length > 1 ? valores[1] : 0,
      situacao: situacaoNota(ultima),
    });
  });
  return saida;
}

/** "Normal", "Cancelada", "Rejeitada", "Denegada"… → normal · cancelada · rejeitada. */
function situacaoNota(texto) {
  const t = normalizar(texto);
  if (/CANCEL/.test(t)) return 'cancelada';
  if (/REJEIT|DENEG|INUTIL/.test(t)) return 'rejeitada';
  return 'normal';
}

/** Só os 14 dígitos do CNPJ (ou '' se não houver). */
function cnpjSoDigitos(texto) {
  const d = String(texto || '').replace(/\D/g, '');
  return d.length === 14 ? d : '';
}

/** Tira tags, entidades e espaços repetidos de um trecho de HTML. */
function limparHtml(trecho) {
  return String(trecho || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); })
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Funções puras: DANFE (detalhe da nota) ----------

/**
 * DANFE em HTML (`NotaFiscalHtml?tpDoc=…&idDocFiscal=…`) → {
 *   chave_acesso (44 dígitos), cnpj, emitente, data_emissao ("aaaa-mm-dd hh:mm"), valor, frete, desconto,
 *   forma_pgto, itens: [{ d, c, q, un, vu, vt }], protocolo, qtd_itens }.
 *
 * Reconhece o leiaute padrão da consulta pública de NFC-e (spans `txtTit`, `RCod`, `Rqtd`, `RUN`, `RvlUnit`,
 * `valor`; rótulos "Valor total R$", "Desconto R$", "Valor a pagar R$", "Forma de pagamento") e, como reserva,
 * uma tabela genérica de itens (descrição · código · qtde · un · vl. unit · vl. total).
 */
function extrairDanfePr(html) {
  const h = String(html || '');
  const txt = limparHtml(h);
  const saida = { chave_acesso: '', cnpj: '', emitente: '', data_emissao: '', valor: 0, frete: 0, desconto: 0, forma_pgto: '', itens: [], protocolo: '', qtd_itens: 0 };
  // Chave de acesso: 44 dígitos, podendo vir em grupos de 4 separados por espaço.
  const chave = h.match(/(?:\d{4}\s*){11}/);
  if (chave) saida.chave_acesso = chave[0].replace(/\D/g, '').slice(0, 44);
  // Emitente: primeiro bloco `txtTopo`, ou o texto antes de "CNPJ:".
  const topo = h.match(/class="txtTopo"[^>]*>([\s\S]*?)<\/div>/i);
  if (topo) saida.emitente = limparHtml(topo[1]);
  const cnpj = txt.match(/CNPJ:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
  if (cnpj) saida.cnpj = cnpjSoDigitos(cnpj[1]);
  if (!saida.emitente) {
    const antes = txt.match(/([A-ZÀ-Ü][A-ZÀ-Ü0-9 .&'-]{4,80})\s+CNPJ:/);
    if (antes) saida.emitente = antes[1].trim();
  }
  // Emissão: "Emissão: 03/11/2026 18:42:10".
  const emissao = txt.match(/Emiss[aã]o:?\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/i) || txt.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
  if (emissao) saida.data_emissao = emissao[3] + '-' + emissao[2] + '-' + emissao[1] + (emissao[4] ? ' ' + emissao[4] : '');
  // Totais.
  const total = txt.match(/Valor total R\$:?\s*(-?[\d.]+,\d{2})/i);
  const pagar = txt.match(/Valor a pagar R\$:?\s*(-?[\d.]+,\d{2})/i);
  const desconto = txt.match(/Descontos? R\$:?\s*(-?[\d.]+,\d{2})/i);
  const frete = txt.match(/Frete R\$:?\s*(-?[\d.]+,\d{2})/i);
  const qtd = txt.match(/Qtd\.? total de itens:?\s*(\d+)/i);
  saida.valor = lerValor(pagar ? pagar[1] : total ? total[1] : 0);
  saida.desconto = lerValor(desconto ? desconto[1] : 0);
  saida.frete = lerValor(frete ? frete[1] : 0);
  saida.qtd_itens = qtd ? Number(qtd[1]) : 0;
  const forma = txt.match(/Forma de pagamento:?\s*([A-Za-zÀ-ü ]+?)(?=\s+(?:Valor pago|Troco|Informa|Consulte|Chave|$))/i);
  if (forma) saida.forma_pgto = forma[1].trim();
  const protocolo = txt.match(/Protocolo de autoriza[cç][aã]o:?\s*(\d{10,20})/i);
  if (protocolo) saida.protocolo = protocolo[1];
  // Itens — leiaute de spans.
  const blocos = h.match(/<span class="txtTit">[\s\S]*?class="valor">[\s\S]*?<\/span>/gi) || [];
  blocos.forEach(function (b) {
    const d = limparHtml((b.match(/class="txtTit">([\s\S]*?)<\/span>/i) || ['', ''])[1]);
    const c = limparHtml((b.match(/class="RCod">([\s\S]*?)<\/span>/i) || ['', ''])[1]).replace(/.*?(\d+)\D*$/, '$1');
    const q = lerValor(limparHtml((b.match(/class="Rqtd">([\s\S]*?)<\/span>/i) || ['', ''])[1]).replace(/.*?:/, ''));
    const un = limparHtml((b.match(/class="RUN">([\s\S]*?)<\/span>/i) || ['', ''])[1]).replace(/.*?:/, '').trim();
    const vu = lerValor(limparHtml((b.match(/class="RvlUnit">([\s\S]*?)<\/span>/i) || ['', ''])[1]).replace(/.*?:/, ''));
    const vt = lerValor(limparHtml((b.match(/class="valor">([\s\S]*?)<\/span>/i) || ['', ''])[1]));
    if (d) saida.itens.push(itemNota(d, c, q, un, vu, vt));
  });
  // Itens — tabela genérica (reserva): linhas com descrição + 3 números + unidade.
  if (!saida.itens.length) {
    const linhas = h.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    linhas.forEach(function (tr) {
      const cel = (tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || []).map(limparHtml);
      if (cel.length < 5) return;
      const nums = cel.map(function (c) { return /^-?\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?$/.test(c) ? lerValor(c) : null; });
      const idxNum = nums.map(function (n, i) { return n === null ? -1 : i; }).filter(function (i) { return i >= 0; });
      if (idxNum.length < 3 || !/[A-Za-z]{3}/.test(cel[0])) return;
      const un = cel.find(function (c) { return /^[A-Z]{1,3}$/i.test(c); }) || '';
      const codigo = cel.find(function (c, i) { return i > 0 && /^\d{3,14}$/.test(c); }) || '';
      saida.itens.push(itemNota(cel[0], codigo, nums[idxNum[idxNum.length - 3]], un, nums[idxNum[idxNum.length - 2]], nums[idxNum[idxNum.length - 1]]));
    });
  }
  if (!saida.valor && saida.itens.length) saida.valor = arredondar(somar(saida.itens, function (i) { return i.vt; }));
  if (!saida.qtd_itens) saida.qtd_itens = saida.itens.length;
  return saida;
}

/** Item compacto para a coluna `itens` (JSON curto): d=descrição, c=código, q=qtde, un, vu=unitário, vt=total. */
function itemNota(d, c, q, un, vu, vt) {
  return semUndefined({ d: String(d || '').slice(0, 60), c: c || undefined, q: q || 0, un: un || undefined, vu: vu || 0, vt: vt || 0 });
}

/** "Cartão de Crédito" → crédito · "Cartão de Débito" → débito · "Dinheiro" → dinheiro · "PIX" → pix (função pura). */
function formaPgtoDaNota(texto) {
  const t = normalizar(texto);
  if (/CREDITO/.test(t)) return 'crédito';
  if (/DEBITO/.test(t)) return 'débito';
  if (/DINHEIRO/.test(t)) return 'dinheiro';
  if (/PIX|INSTANT/.test(t)) return 'pix';
  if (/BOLETO/.test(t)) return 'boleto';
  return 'débito';
}

// ---------- Rede: login, lista e detalhe ----------

/**
 * Faz o login no Nota Paraná pela Identidade Digital Sefa/PR, só com UrlFetchApp.
 * Devolve { ok, etapa, motivo, status, saltos, pote }. Nada do retorno além de ok/etapa/motivo/status/saltos
 * pode ir para log.
 *
 * Caminho: GET /nfprweb/Extrato → 302s até authentication.jsp?response_type=code&client_id=…&code_challenge=…
 *          → POST api/v1/authorize (campos da URL + step=2 + attribute=CPF + password)
 *          → 302 redirect_uri?code=…&state=… → 302s no notaparana.pr.gov.br até a página logada.
 */
function loginNotaParana(credencial) {
  const pote = {};
  const resultado = { ok: false, etapa: 'inicio', motivo: '', status: 0, saltos: [], pote: pote };
  if (!credencial || !credencial.cpf || !credencial.senha) { resultado.motivo = 'credencial ausente'; return resultado; }
  let r;
  try {
    resultado.etapa = 'entrada';
    r = seguirRedirecionamentos(NOTAPR_URL_ENTRADA, pote);
    resultado.saltos = r.saltos.slice();
    resultado.status = r.status;
    let classe = classificarRespostaPortal(r.status, r.texto, r.url);
    if (classe === 'bloqueado' || classe === 'desafio') { resultado.motivo = classe; return resultado; }
    if (!ehPaginaLoginSefa(r.url, r.texto)) { resultado.motivo = 'não chegou ao formulário da Sefa (' + classe + ')'; return resultado; }

    resultado.etapa = 'autenticacao';
    const campos = camposDoFormularioSefa(r.url);
    campos.attribute = String(credencial.cpf).replace(/\D/g, '');
    campos.password = String(credencial.senha);
    const urlPost = resolverUrl(r.url, extrairAcaoFormulario(r.texto, /id="authForm"/i) || 'api/v1/authorize');
    const corpo = Object.keys(campos).map(function (k) { return k + '=' + encodeURIComponent(campos[k]); }).join('&');
    const post = requisicaoPortal(urlPost, { method: 'post', payload: corpo, headers: { Referer: r.url, Origin: 'https://' + SEFA_AUTHZ_HOST } }, pote);
    resultado.status = post.status;
    resultado.saltos.push(hostDeUrl(urlPost) + '/…/authorize [' + post.status + ']');
    classe = classificarRespostaPortal(post.status, post.texto, post.local || urlPost);
    if (classe === 'bloqueado' || classe === 'desafio' || classe === 'senha_invalida') { resultado.motivo = classe; return resultado; }
    if (!(post.status >= 300 && post.status < 400 && post.local)) { resultado.motivo = 'a Sefa não redirecionou após o POST (' + classe + ')'; return resultado; }
    if (ehPaginaLoginSefa(post.local, '')) { resultado.motivo = classificarRespostaPortal(200, '', post.local) === 'senha_invalida' ? 'senha_invalida' : 'voltou ao formulário'; return resultado; }

    resultado.etapa = 'retorno';
    const volta = seguirRedirecionamentos(resolverUrl(urlPost, post.local), pote);
    resultado.saltos = resultado.saltos.concat(volta.saltos);
    resultado.status = volta.status;
    classe = classificarRespostaPortal(volta.status, volta.texto, volta.url);
    if (classe !== 'ok') { resultado.motivo = 'retorno do OAuth terminou em ' + classe; return resultado; }
    if (ehPaginaLoginSefa(volta.url, volta.texto)) { resultado.motivo = 'voltou ao formulário'; return resultado; }
    if (hostDeUrl(volta.url) !== hostDeUrl(NOTAPR_URL_BASE)) { resultado.motivo = 'terminou fora do Nota Paraná'; return resultado; }
    if (!contarCookies(pote, hostDeUrl(NOTAPR_URL_BASE))) { resultado.motivo = 'sem cookie de sessão'; return resultado; }
    resultado.ok = true;
    resultado.motivo = 'ok';
    return resultado;
  } catch (e) {
    resultado.motivo = /^conexao/.test(e.message) ? 'conexao_recusada' : 'erro: ' + textoSeguroParaLog(e.message);
    return resultado;
  }
}

/** Com a sessão aberta, baixa a lista do mês (`NotasFiscaisAjax`). Devolve { status, classe, html, notas, quantidade, tamanho }. */
function listarMesNotaParana(pote, ano, mes, incluirCanceladas) {
  const url = NOTAPR_URL_LISTA + '?periodo=' + encodeURIComponent(periodoNotaPr(ano, mes)) + '&situacao=' + (incluirCanceladas ? '0' : '1');
  const r = requisicaoPortal(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: NOTAPR_URL_ENTRADA } }, pote);
  const classe = classificarRespostaPortal(r.status, r.texto, url);
  const notas = classe === 'ok' ? extrairListaNotasPr(r.texto) : [];
  return { status: r.status, classe: classe, html: r.texto, notas: notas, quantidade: classe === 'ok' ? contarNotasPr(r.texto) : 0, tamanho: r.texto.length };
}

/** Compatibilidade com a Fase 0: só a contagem do mês. */
function listarNotasMesNotaParana(pote, ano, mes) {
  const r = listarMesNotaParana(pote, ano, mes);
  return { status: r.status, quantidade: r.quantidade, classe: r.classe, tamanho: r.tamanho };
}

/** Com a sessão aberta, baixa o DANFE de uma nota e devolve o resultado de extrairDanfePr (ou null se falhar). */
function lerDanfeNotaParana(pote, tpDoc, idPortal) {
  const url = NOTAPR_URL_DANFE + '?tpDoc=' + encodeURIComponent(tpDoc) + '&idDocFiscal=' + encodeURIComponent(idPortal);
  const r = requisicaoPortal(url, { headers: { Referer: NOTAPR_URL_ENTRADA } }, pote);
  if (classificarRespostaPortal(r.status, r.texto, url) !== 'ok') return null;
  return extrairDanfePr(r.texto);
}

/**
 * Leitor completo usado pela sincronização: login + lista dos meses pedidos. Devolve
 * { ok, motivo, pote, notas: [...lista normalizada], meses_lidos }. Os detalhes (DANFE) são buscados
 * depois, só para as notas novas (limite por execução em notasFiscais.gs).
 */
function lerNotaParana(credencial, meses) {
  const login = loginNotaParana(credencial);
  if (!login.ok) return { ok: false, motivo: login.motivo, etapa: login.etapa, notas: [], meses_lidos: 0 };
  const notas = [];
  let mesesLidos = 0;
  (meses || []).forEach(function (m, i) {
    if (i > 0) pausaEntreRequisicoes();
    const r = listarMesNotaParana(login.pote, m.ano, m.mes, true);
    if (r.classe !== 'ok') return;
    mesesLidos++;
    r.notas.forEach(function (n) { notas.push(Object.assign({ fonte: 'nota_parana' }, n)); });
  });
  return { ok: true, motivo: 'ok', pote: login.pote, notas: notas, meses_lidos: mesesLidos };
}

// ---------- Fase 0: prova de conceito ----------

/**
 * FASE 0 — Prova de conceito do Nota Paraná. Rode no editor do Apps Script e veja o Registro de execução.
 * Antes, crie a propriedade do script `NOTAPR_<usuario_id>` com `{"cpf":"...","senha":"..."}`
 * (Configurações do projeto → Propriedades do script) — ou conecte pelo app em Configurações → Notas fiscais.
 * Sem argumento, usa a primeira credencial encontrada.
 * Imprime SÓ "login ok · N notas em MM/AAAA" ou o motivo da falha. Nada sensível.
 */
function testeLoginNotaParana(usuarioId) {
  const uid = usuarioId || listarUsuariosComCredencial(PREFIXO_CRED_NOTAPR)[0];
  if (!uid) { const m = 'Nenhuma credencial: crie a propriedade do script NOTAPR_<usuario_id> = {"cpf":"…","senha":"…"}'; Logger.log(m); return m; }
  const cred = lerCredencialFiscal(PREFIXO_CRED_NOTAPR, uid);
  if (!cred) { const m = 'Propriedade NOTAPR_' + uid + ' não é um JSON válido com cpf e senha'; Logger.log(m); return m; }
  const inicio = Date.now();
  const login = loginNotaParana(cred);
  const linhas = ['Nota Paraná — prova de conceito (usuário ' + uid + ')', 'caminho: ' + login.saltos.join(' → ')];
  if (!login.ok) {
    linhas.push('FALHOU na etapa "' + login.etapa + '": ' + login.motivo + (login.status ? ' (HTTP ' + login.status + ')' : ''));
    linhas.push(dicaFase0(login.motivo));
  } else {
    const hoje = new Date();
    const lista = listarNotasMesNotaParana(login.pote, hoje.getFullYear(), hoje.getMonth() + 1);
    if (lista.classe !== 'ok') linhas.push('login ok, mas a lista do mês voltou "' + lista.classe + '" (HTTP ' + lista.status + ', ' + lista.tamanho + ' bytes)');
    else linhas.push('login ok · ' + lista.quantidade + ' notas em ' + zeros(hoje.getMonth() + 1, 2) + '/' + hoje.getFullYear());
  }
  linhas.push('tempo: ' + Math.round((Date.now() - inicio) / 100) / 10 + ' s');
  const texto = linhas.join('\n');
  Logger.log(texto);
  return texto;
}

/** Tradução do motivo em próximo passo (texto fixo, sem dados). */
function dicaFase0(motivo) {
  if (motivo === 'conexao_recusada' || motivo === 'bloqueado') return '→ O portal não aceita conexões do IP do Google: seguir pelo Plano B (coletor externo + ?webhook=notas) ou rodar o robô de um computador no Brasil.';
  if (motivo === 'desafio') return '→ O portal pede captcha/desafio: Plano B, ou aguardar; o QR Code da NFC-e continua funcionando.';
  if (motivo === 'senha_invalida') return '→ Confira CPF e senha (o robô não tenta de novo para não bloquear a conta).';
  return '→ Guarde esta saída (ela não tem dados pessoais) e mande para ajustar o robô.';
}
