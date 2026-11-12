/**
 * notasFiscais.gs — Robô de Notas Fiscais: parte comum aos portais, sincronização, conciliação e API.
 *
 * Especificação: docs/ROBO_NOTAS_FISCAIS.md. Os leitores de cada portal ficam em notaParana.gs e
 * notaCuritibana.gs; aqui ficam:
 *  - ajudantes PUROS de rede (URL, HTML, cookies, classificação da resposta) usados pelos dois leitores;
 *  - credenciais (só nas Propriedades do script: NOTAPR_<uid> / NOTACWB_<uid>, gravadas e nunca devolvidas);
 *  - a aba NotasFiscais (uma linha por nota; chave_acesso é a chave única);
 *  - conciliação (seção 5): já existe pela chave? pelo jeito antigo (compraJaExiste)? senão Caixa de Entrada
 *    ou lançamento direto quando a loja já é conhecida;
 *  - regra Família × Empresa (seção 6) e aprendizado por CNPJ (RegrasLoja.destino / cnpj);
 *  - sincronizarNotasFiscais() (seção 7): gatilho a cada 6 h + 21h, janela de 2 meses, no máximo 40 detalhes
 *    por execução, pausa entre requisições, suspensão após 2 falhas de login, resumo por Telegram/e-mail;
 *  - buscar_nota_fiscal (seção 8) para o Assistente e a voz, com a espera `aguardando_nota` na Caixa;
 *  - ações da API (seção 9) e o webhook `?webhook=notas` do Plano B.
 *
 * Regra de ouro: CPF, senha, cookies, tokens e códigos NUNCA vão para log, planilha, Git ou mensagem.
 */

// ---------- Constantes ----------

/** Prefixos das credenciais nas Propriedades do script (uma por membro adulto). */
const PREFIXO_CRED_NOTAPR = 'NOTAPR_';
const PREFIXO_CRED_NOTACWB = 'NOTACWB_';
/** Fontes conhecidas e o prefixo da credencial de cada uma. */
const FONTES_NOTAS = { nota_parana: { prefixo: PREFIXO_CRED_NOTAPR, nome: 'Nota Paraná' }, nota_curitibana: { prefixo: PREFIXO_CRED_NOTACWB, nome: 'Nota Curitibana' } };
/** Máximo de saltos (redirecionamentos) seguidos numa sequência. */
const NOTAS_MAX_SALTOS = 12;
/** Máximo de detalhes (DANFE) baixados por execução (limite de 6 min do Apps Script). */
const NOTAS_MAX_DETALHES_POR_EXECUCAO = 40;
/** Tempo máximo de uma passada antes de parar e deixar o resto para a próxima (ms). */
const NOTAS_TEMPO_MAXIMO_MS = 4.5 * 60 * 1000;
/** Falhas de login seguidas que suspendem a fonte daquele membro (para não bloquear a conta). */
const NOTAS_MAX_FALHAS_LOGIN = 2;
/** Chaves na Config por fonte/usuário (estado do robô, sem segredos). */
const NOTAS_CHAVE_ESTADO = 'notas_estado_';
/** Destinos possíveis de uma nota. */
const DESTINOS_NOTA = ['familia', 'empresa', 'ignorar', 'a_confirmar'];

// ---------- Funções puras: URL ----------

/** "https://a.b/c?d" → "a.b" (minúsculo, sem porta). */
function hostDeUrl(url) {
  const m = String(url || '').match(/^[a-z]+:\/\/([^/?#:]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/** Resolve um endereço relativo (`api/v1/authorize`, `/Home/Index`, `//cdn/x`) contra a página atual. */
function resolverUrl(base, relativa) {
  const r = String(relativa || '').trim();
  if (!r) return String(base || '');
  if (/^[a-z]+:\/\//i.test(r)) return r;
  const m = String(base || '').match(/^([a-z]+:)\/\/([^/?#]+)(\/[^?#]*)?/i);
  if (!m) return r;
  const esquema = m[1], host = m[2], caminho = m[3] || '/';
  if (r.indexOf('//') === 0) return esquema + r;
  if (r.charAt(0) === '/') return esquema + '//' + host + r;
  if (r.charAt(0) === '?') return esquema + '//' + host + caminho + r;
  const pasta = caminho.slice(0, caminho.lastIndexOf('/') + 1);
  return esquema + '//' + host + pasta + r;
}

// ---------- Funções puras: HTML ----------

/** `<input type="hidden" name="x" value="y">` → { x: 'y' } (serve para o token antifalsificação do Nota Curitibana). */
function extrairCamposOcultos(html) {
  const saida = {};
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const tag = m[0];
    if (!/type\s*=\s*["']?hidden/i.test(tag)) continue;
    const nome = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
    const valor = tag.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
    if (nome) saida[nome[1]] = valor ? valor[1] : '';
  }
  return saida;
}

/** `action` do primeiro `<form>` cujo HTML casa com o filtro (ou do primeiro formulário). */
function extrairAcaoFormulario(html, filtro) {
  const re = /<form\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    if (filtro && !filtro.test(m[0])) continue;
    const a = m[0].match(/\baction\s*=\s*["']([^"']*)["']/i);
    return a ? a[1] : '';
  }
  return '';
}

/**
 * Classifica uma resposta HTTP do portal (sem guardar nada dela):
 *  - `bloqueado`: 403/429/5xx ou página de WAF (o IP do Google foi barrado → Plano B);
 *  - `desafio`: captcha ou prova de trabalho (reCAPTCHA, hCaptcha, Turnstile, ALTCHA);
 *  - `senha_invalida`: a Sefa voltou ao formulário com mensagem de usuário/senha;
 *  - `formulario_login`: ainda estamos no formulário (login não aconteceu);
 *  - `ok`: página comum (2xx);
 *  - `redirecionamento`: 3xx;
 *  - `desconhecido`: o resto.
 */
function classificarRespostaPortal(status, html, url) {
  const h = String(html || '');
  const u = String(url || '');
  if (/recaptcha|hcaptcha|turnstile|altcha|captcha/i.test(h)) return 'desafio';
  if (status === 403 || status === 429 || status >= 500) return 'bloqueado';
  if (/access denied|request blocked|incapsula|cloudflare.*(challenge|attention)/i.test(h)) return 'bloqueado';
  if (ehPaginaLoginSefa(u, h)) {
    const q = lerQueryString(u);
    const msg = decodeURIComponent(String(q.mensagem || '').replace(/\+/g, ' ')).toLowerCase();
    if (/senha|inv[aá]lid|incorret|bloquead/.test(msg)) return 'senha_invalida';
    if (/senha inv|usu[aá]rio ou senha|credenciais inv/i.test(h)) return 'senha_invalida';
    return 'formulario_login';
  }
  if (status >= 300 && status < 400) return 'redirecionamento';
  if (status >= 200 && status < 300) return 'ok';
  return 'desconhecido';
}

/** Tira do texto qualquer sequência de 6+ dígitos e valores longos de cookie/token antes de ir para o log. */
function textoSeguroParaLog(texto) {
  return String(texto || '')
    .replace(/\d[\d.\-\/ ]{5,}\d/g, '•••')
    .replace(/(cookie|token|code|senha|password|authorization)[=:]\s*\S+/gi, '$1=•••')
    .slice(0, 300);
}

// ---------- Funções puras: cookies ----------

/**
 * Pote de cookies em memória: { 'host.ou.dominio': { nome: valor } }.
 * Guarda cada `Set-Cookie` sob o `Domain` informado (sem o ponto inicial) ou sob o host da resposta.
 * Atributos (Path, Secure, Expires…) são ignorados de propósito: tudo é HTTPS e dura só esta execução.
 */
function guardarCookies(pote, host, setCookie) {
  if (!setCookie) return pote;
  const lista = Array.isArray(setCookie) ? setCookie : [setCookie];
  lista.forEach(function (linha) {
    const partes = String(linha).split(';');
    const par = partes[0];
    const i = par.indexOf('=');
    if (i <= 0) return;
    const nome = par.slice(0, i).trim();
    const valor = par.slice(i + 1).trim();
    let dominio = String(host || '').toLowerCase();
    partes.slice(1).forEach(function (atr) {
      const m = atr.trim().match(/^domain=(.+)$/i);
      if (m) dominio = m[1].trim().replace(/^\./, '').toLowerCase();
    });
    if (!pote[dominio]) pote[dominio] = {};
    if (/^(deleted|)$/i.test(valor)) delete pote[dominio][nome];
    else pote[dominio][nome] = valor;
  });
  return pote;
}

/** Cabeçalho `Cookie` para um host: cookies do próprio host e dos domínios-pai guardados. */
function cabecalhoCookie(pote, host) {
  const h = String(host || '').toLowerCase();
  const pares = [];
  Object.keys(pote || {}).forEach(function (dominio) {
    if (h === dominio || h.slice(-(dominio.length + 1)) === '.' + dominio) {
      Object.keys(pote[dominio]).forEach(function (nome) { pares.push(nome + '=' + pote[dominio][nome]); });
    }
  });
  return pares.join('; ');
}

/** Quantos cookies há para um host (só para o relatório da prova de conceito, nunca os valores). */
function contarCookies(pote, host) {
  const c = cabecalhoCookie(pote, host);
  return c ? c.split('; ').length : 0;
}

// ---------- Rede (UrlFetchApp) ----------

/**
 * Uma requisição sem seguir redirecionamentos, com o pote de cookies.
 * Devolve { status, url, local (Location), texto, tipo (Content-Type) } e já guarda os Set-Cookie.
 * Lança Error('conexao') quando o portal recusa a conexão (reset, timeout, DNS).
 */
function requisicaoPortal(url, opcoes, pote) {
  const host = hostDeUrl(url);
  const o = opcoes || {};
  const cabecalhos = {
    'User-Agent': 'FinancasDaFamilia/2 (robo de notas fiscais; Apps Script)',
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };
  Object.keys(o.headers || {}).forEach(function (k) { cabecalhos[k] = o.headers[k]; });
  const cookie = cabecalhoCookie(pote, host);
  if (cookie) cabecalhos.Cookie = cookie;
  const params = { method: o.method || 'get', headers: cabecalhos, followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: true };
  if (o.payload !== undefined) {
    params.payload = o.payload;
    if (!cabecalhos['Content-Type'] && typeof o.payload === 'string') params.contentType = 'application/x-www-form-urlencoded';
  }
  let resposta;
  try {
    resposta = UrlFetchApp.fetch(url, params);
  } catch (e) {
    throw new Error('conexao: ' + textoSeguroParaLog(e && e.message));
  }
  const status = resposta.getResponseCode();
  const todos = resposta.getAllHeaders() || {};
  const chaveSet = Object.keys(todos).filter(function (k) { return k.toLowerCase() === 'set-cookie'; })[0];
  if (chaveSet) guardarCookies(pote, host, todos[chaveSet]);
  const chaveLoc = Object.keys(todos).filter(function (k) { return k.toLowerCase() === 'location'; })[0];
  const chaveTipo = Object.keys(todos).filter(function (k) { return k.toLowerCase() === 'content-type'; })[0];
  const tipo = chaveTipo ? String(todos[chaveTipo]) : '';
  const charset = (tipo.match(/charset=([\w-]+)/i) || [])[1];
  let texto = '';
  try { texto = charset ? resposta.getContentText(charset) : resposta.getContentText(); } catch (e) { texto = resposta.getContentText(); }
  return { status: status, url: url, local: chaveLoc ? String(todos[chaveLoc]) : '', texto: texto, tipo: tipo };
}

/**
 * Segue redirecionamentos à mão (para não perder os cookies de cada host no caminho do OAuth).
 * Para no primeiro 2xx/4xx/5xx. Devolve a última resposta mais `saltos` (lista de hosts visitados, sem
 * query string — serve para o relatório).
 */
function seguirRedirecionamentos(url, pote, opcoesPrimeira) {
  let atual = url;
  let opcoes = opcoesPrimeira || {};
  const saltos = [];
  for (let i = 0; i < NOTAS_MAX_SALTOS; i++) {
    const r = requisicaoPortal(atual, opcoes, pote);
    saltos.push(hostDeUrl(atual) + String(atual.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0]));
    if (r.status >= 300 && r.status < 400 && r.local) {
      atual = resolverUrl(atual, r.local);
      opcoes = {}; // depois de um 302 o navegador faz GET sem corpo
      continue;
    }
    r.saltos = saltos;
    return r;
  }
  throw new Error('redirecionamentos demais (' + saltos.length + ')');
}

/** Pausa de 1 a 2 s entre requisições ao portal (educação com o servidor público). */
function pausaEntreRequisicoes() {
  try { Utilities.sleep(1000 + Math.floor(Math.random() * 1000)); } catch (e) { /* fora do Apps Script */ }
}

// ---------- Credenciais (Propriedades do script) ----------

/** Lê a credencial de um membro para uma fonte. Devolve null se não houver. Nunca registre o retorno. */
function lerCredencialFiscal(prefixo, usuarioId) {
  const bruto = propriedade(prefixo + usuarioId, '');
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch (e) { return null; }
}

/** Ids de usuário que têm credencial para o prefixo (NOTAPR_ / NOTACWB_). Só os ids, nunca os valores. */
function listarUsuariosComCredencial(prefixo) {
  const todas = PropertiesService.getScriptProperties().getProperties() || {};
  return Object.keys(todas).filter(function (k) { return k.indexOf(prefixo) === 0; }).map(function (k) { return k.slice(prefixo.length); }).sort();
}

/** Grava (ou substitui) a credencial de um membro. Só escrita. */
function gravarCredencialFiscal(fonte, usuarioId, credencial) {
  const f = FONTES_NOTAS[fonte];
  if (!f) throw new ErroUsuario('Fonte desconhecida: ' + fonte);
  PropertiesService.getScriptProperties().setProperty(f.prefixo + usuarioId, JSON.stringify(credencial));
}

/** Apaga a credencial e o estado daquele membro/fonte. */
function apagarCredencialFiscal(fonte, usuarioId) {
  const f = FONTES_NOTAS[fonte];
  if (!f) throw new ErroUsuario('Fonte desconhecida: ' + fonte);
  PropertiesService.getScriptProperties().deleteProperty(f.prefixo + usuarioId);
  gravarEstadoNotas(fonte, usuarioId, null);
}

/** Valida e normaliza a credencial vinda do app (função pura). */
function prepararCredencialFiscal(fonte, entrada) {
  const e = entrada || {};
  const senha = String(e.senha || '');
  if (!senha) throw new ErroUsuario('Informe a senha.');
  if (fonte === 'nota_parana') {
    const cpf = String(e.cpf || e.usuario || '').replace(/\D/g, '');
    if (cpf.length !== 11) throw new ErroUsuario('Informe o CPF com 11 dígitos.');
    return { cpf: cpf, senha: senha };
  }
  if (fonte === 'nota_curitibana') {
    const usuario = String(e.usuario || e.cpf || '').trim();
    if (!usuario) throw new ErroUsuario('Informe o usuário (CPF) do e-Cidadão.');
    return { usuario: usuario, senha: senha };
  }
  throw new ErroUsuario('Fonte desconhecida: ' + fonte);
}

// ---------- Estado do robô por fonte/usuário (aba Config, sem segredos) ----------

/** { conectado_em, ultima_leitura, ultimo_ok, notas_novas, falhas, suspenso, motivo, cursor } ou {} */
function lerEstadoNotas(fonte, usuarioId) {
  const bruto = lerConfigCompleta()[NOTAS_CHAVE_ESTADO + fonte + '_' + usuarioId];
  if (!bruto) return {};
  try { return JSON.parse(bruto) || {}; } catch (e) { return {}; }
}

function gravarEstadoNotas(fonte, usuarioId, estado) {
  const obj = {};
  obj[NOTAS_CHAVE_ESTADO + fonte + '_' + usuarioId] = estado ? JSON.stringify(estado) : '';
  salvarConfigChaves(obj);
}

/** Mescla mudanças no estado e grava. */
function atualizarEstadoNotas(fonte, usuarioId, mudancas) {
  const novo = Object.assign({}, lerEstadoNotas(fonte, usuarioId), mudancas);
  gravarEstadoNotas(fonte, usuarioId, novo);
  return novo;
}

// ---------- Aba NotasFiscais ----------

/** Resumo público de uma nota (para a Caixa e para o app): sem a chave inteira, com a contagem de itens. */
function notaFiscalResumo(n) {
  if (!n) return null;
  let itens = [];
  try { itens = n.itens ? JSON.parse(n.itens) : []; } catch (e) { itens = []; }
  return {
    id: n.id, fonte: n.fonte, tp_doc: String(n.tp_doc || ''), chave_final: String(n.chave_acesso || '').slice(-8), cnpj: n.cnpj || '', emitente: n.emitente || '',
    data_emissao: n.data_emissao || '', valor: arredondar(n.valor), desconto: arredondar(n.desconto), frete: arredondar(n.frete), forma_pgto: n.forma_pgto || '',
    qtd_itens: itens.length, itens: itens.slice(0, 40), situacao: n.situacao || 'normal', destino: n.destino || '', usuario_id: n.usuario_id || '',
    lancamento_id: n.lancamento_id || '', caixa_id: n.caixa_id || '',
  };
}

/** { caixa_id: nota } para juntar à Caixa de Entrada. */
function indexarNotasPorCaixa(notas) {
  const mapa = {};
  (notas || []).forEach(function (n) { if (n.caixa_id) mapa[n.caixa_id] = n; });
  return mapa;
}

/** Converte uma nota lida do portal (lista + detalhe) na linha da aba. */
function montarLinhaNota(lida, detalhe, usuarioId) {
  const d = detalhe || {};
  return {
    id: gerarId('nf'), fonte: lida.fonte, chave_acesso: d.chave_acesso || lida.chave_acesso || '', id_portal: String(lida.id_portal || ''), tp_doc: String(lida.tp_doc || ''),
    usuario_id: usuarioId, cnpj: d.cnpj || lida.cnpj || '', emitente: d.emitente || lida.emitente || '',
    data_emissao: d.data_emissao || lida.data_emissao || '', valor: arredondar(d.valor || lida.valor), frete: arredondar(d.frete), desconto: arredondar(d.desconto),
    forma_pgto: d.forma_pgto || '', itens: d.itens && d.itens.length ? JSON.stringify(d.itens).slice(0, 45000) : '', situacao: lida.situacao || 'normal',
    destino: '', lancamento_id: '', caixa_id: '', lida_em: agoraIso(), atualizada_em: agoraIso(),
  };
}

/** Procura a nota já gravada: pela chave de acesso ou por fonte + id do portal (função pura). */
function encontrarNotaGravada(lida, notas) {
  const chave = String(lida.chave_acesso || '');
  return (notas || []).find(function (n) { return (chave && n.chave_acesso === chave) || (n.fonte === lida.fonte && String(n.id_portal) === String(lida.id_portal)); }) || null;
}

// ---------- Conciliação (seção 5) — funções puras ----------

/** Texto curto dos itens para sugerir categoria e para a Caixa ("TAT HOT FILA, CAFE PILAO…"). */
function textoDosItens(itens, maximo) {
  return (itens || []).slice(0, maximo || 6).map(function (i) { return String(i.d || '').trim(); }).filter(Boolean).join(', ');
}

/** Regra de loja por CNPJ ou por nome (CNPJ vale mais). Função pura. */
function regraDaNota(cnpj, emitente, regras) {
  const porCnpj = cnpj ? (regras || []).find(function (r) { return r.cnpj && String(r.cnpj).replace(/\D/g, '') === String(cnpj).replace(/\D/g, ''); }) : null;
  if (porCnpj) return porCnpj;
  const chave = normalizar(emitente);
  let melhor = null;
  (regras || []).forEach(function (r) {
    const k = String(r.loja_normalizada || '');
    if (k && (chave === k || chave.indexOf(k) >= 0) && (!melhor || k.length > melhor.loja_normalizada.length)) melhor = r;
  });
  return melhor;
}

/**
 * Regra Família × Empresa (seção 6). Devolve 'empresa' | 'ignorar' | 'a_confirmar' | 'familia'.
 * `extras` = { mes_fora_do_padrao: bool }.
 */
function classificarDestinoNota(nota, regras, cfg, extras) {
  const c = cfg || {};
  const regra = regraDaNota(nota.cnpj, nota.emitente, regras);
  if (regra && regra.destino === 'empresa' && (Number(regra.acertos) || 0) >= 2) return 'empresa';
  if (regra && regra.destino === 'ignorar' && (Number(regra.acertos) || 0) >= 2) return 'ignorar';
  const limiteGrande = Number(c.notas_limite_grande) > 0 ? Number(c.notas_limite_grande) : 1500;
  const limiteDireto = Number(c.notas_limite_direto) > 0 ? Number(c.notas_limite_direto) : 500;
  if (nota.valor > limiteGrande) return 'a_confirmar';
  if (String(nota.tp_doc) === '1' && nota.valor > limiteDireto) return 'a_confirmar';
  if (extras && extras.mes_fora_do_padrao) return 'a_confirmar';
  return 'familia';
}

/** Mesma loja? primeira palavra igual ou mesmo CNPJ dentro do texto (função pura). */
function mesmaLoja(a, b, cnpj) {
  const marcantes = function (s) { return normalizar(s).split(' ').filter(function (p) { return p.length >= 3 && PALAVRAS_GENERICAS_LOJA.indexOf(p) < 0; }); };
  const pa = marcantes(a), pb = marcantes(b);
  if (pa.length && pb.length && pa[0] === pb[0]) return true;
  if (pa.some(function (p) { return p.length >= 4 && pb.indexOf(p) >= 0; })) return true;
  if (cnpj && String(b || '').replace(/\D/g, '').indexOf(String(cnpj)) >= 0) return true;
  return false;
}
/** Palavras que não identificam a loja (razão social × nome fantasia). */
const PALAVRAS_GENERICAS_LOJA = ['LTDA', 'EIRELI', 'EPP', 'CIA', 'COMERCIO', 'COMERCIAL', 'INDUSTRIA', 'SUPERMERCADO', 'SUPERMERCADOS', 'SUPER', 'MERCADO', 'CENTER', 'LOJA', 'LOJAS', 'FARMACIA', 'DROGARIA', 'POSTO', 'RESTAURANTE', 'PADARIA', 'MATERIAIS', 'CONSTRUCAO', 'ATACADO', 'VAREJO', 'DISTRIBUIDORA', 'SERVICOS', 'BRASIL', 'BRASILEIRA', 'DOS', 'DAS', 'THE', 'AND', 'COM', 'PARA'];

/** Lançamento que corresponde à nota (função pura): pela chave, ou valor ±0,01 + data ±2 dias + mesma loja/CNPJ. */
function encontrarLancamentoDaNota(nota, lancamentos) {
  const chave = String(nota.chave_acesso || '');
  const data = String(nota.data_emissao || '').slice(0, 10);
  let achado = null;
  (lancamentos || []).forEach(function (l) {
    if (achado || l.excluido) return;
    if (chave && chave.length >= 40 && (String(l.anexo_url || '').indexOf(chave) >= 0 || String(l.descricao || '').indexOf(chave) >= 0)) { achado = l; return; }
    if (Math.abs(Number(l.valor) - Number(nota.valor)) < 0.011 && data && Math.abs(diferencaDias(l.data, data)) <= 2 && mesmaLoja(nota.emitente, l.estabelecimento || l.descricao, nota.cnpj)) achado = l;
  });
  return achado;
}

/** Item pendente (ou à espera da nota) da Caixa que corresponde à nota (função pura). */
function encontrarItemCaixaDaNota(nota, itens) {
  const data = String(nota.data_emissao || '').slice(0, 10);
  return (itens || []).find(function (c) {
    if (c.status === 'aguardando_nota') return (!c.usuario_id || c.usuario_id === nota.usuario_id) && mesmaLoja(nota.emitente, c.estabelecimento, nota.cnpj) && (!c.data_compra || !data || Math.abs(diferencaDias(c.data_compra, data)) <= 3) && (!(c.valor > 0) || Math.abs(c.valor - nota.valor) < 0.011);
    if (c.status !== 'pendente') return false;
    return Math.abs(Number(c.valor) - Number(nota.valor)) < 0.011 && data && Math.abs(diferencaDias(c.data_compra, data)) <= 2 && mesmaLoja(nota.emitente, c.estabelecimento, nota.cnpj);
  }) || null;
}

/**
 * Decide o que fazer com uma nota nova (função pura, seção 5):
 *  { tipo: 'enriquecer', lancamento } · { tipo: 'anexar_caixa', item } · { tipo: 'direto', categoria_id, regra }
 *  · { tipo: 'caixa', sugestoes, destino } · { tipo: 'guardar', destino }  (empresa/ignorar: só guarda).
 */
function decidirConciliacao(nota, d, extras) {
  const regras = d.regras_loja || [];
  const destino = classificarDestinoNota(nota, regras, d.config, extras);
  if (destino === 'empresa' || destino === 'ignorar') return { tipo: 'guardar', destino: destino };
  const l = encontrarLancamentoDaNota(nota, d.lancamentos);
  if (l) return { tipo: 'enriquecer', lancamento: l, destino: 'familia' };
  const item = encontrarItemCaixaDaNota(nota, d.caixa_entrada);
  if (item) return { tipo: 'anexar_caixa', item: item, destino: destino };
  let itens = [];
  try { itens = nota.itens ? (typeof nota.itens === 'string' ? JSON.parse(nota.itens) : nota.itens) : []; } catch (e) { itens = []; }
  const texto = (nota.emitente || '') + ' ' + textoDosItens(itens, 10);
  const sugestoes = aplicarRegraLoja(nota.emitente, sugerirCategoria(texto, d.categorias), regras);
  const regra = regraDaNota(nota.cnpj, nota.emitente, regras);
  const limiteDireto = Number(d.config && d.config.notas_limite_direto) > 0 ? Number(d.config.notas_limite_direto) : 500;
  if (destino === 'familia' && regra && regra.categoria_id && (Number(regra.acertos) || 0) >= 3 && (regra.destino || 'familia') === 'familia' && nota.valor <= limiteDireto && nota.situacao === 'normal') {
    return { tipo: 'direto', categoria_id: regra.categoria_id, regra: regra, destino: 'familia', sugestoes: sugestoes };
  }
  return { tipo: 'caixa', sugestoes: sugestoes, destino: destino };
}

/** Total das notas de um CPF no mês vs. 3× a média dos 6 meses anteriores (função pura). */
function mesForaDoPadraoNotas(notas, usuarioId, competencia) {
  const minhas = (notas || []).filter(function (n) { return n.usuario_id === usuarioId && n.situacao !== 'cancelada' && n.destino !== 'empresa' && n.destino !== 'ignorar'; });
  const totalMes = somar(minhas.filter(function (n) { return String(n.data_emissao || '').slice(0, 7) === competencia; }), function (n) { return n.valor; });
  const anteriores = [];
  for (let k = 1; k <= 6; k++) {
    const c = somarMeses(competencia, -k);
    const t = somar(minhas.filter(function (n) { return String(n.data_emissao || '').slice(0, 7) === c; }), function (n) { return n.valor; });
    if (t > 0) anteriores.push(t);
  }
  if (anteriores.length < 2) return { fora: false, total: arredondar(totalMes), media: 0 };
  const media = somar(anteriores, function (x) { return x; }) / anteriores.length;
  return { fora: totalMes > 3 * media, total: arredondar(totalMes), media: arredondar(media) };
}

// ---------- Conciliação — aplica na planilha ----------

/** Texto da Caixa para uma nota (sem dados pessoais): "Nota fiscal · 23 itens: CAFE, LEITE…". */
function textoCaixaDaNota(nota) {
  let itens = [];
  try { itens = nota.itens ? JSON.parse(nota.itens) : []; } catch (e) { itens = []; }
  const fonte = FONTES_NOTAS[nota.fonte] ? FONTES_NOTAS[nota.fonte].nome : 'Nota fiscal';
  const base = fonte + (nota.tp_doc === 'nfse' ? ' · serviço' : nota.tp_doc === '1' ? ' · NF-e' : ' · cupom') + (itens.length ? ' · ' + itens.length + ' ite' + (itens.length === 1 ? 'm' : 'ns') + ': ' + textoDosItens(itens, 6) : '');
  return base.slice(0, 400);
}

/**
 * Processa uma nota já lida (lista + detalhe) para um usuário: grava na aba e concilia.
 * Devolve { acao, nota } com acao ∈ atualizada · enriquecida · anexada · lancada · caixa · guardada · a_confirmar.
 */
function processarNota(lida, detalhe, usuarioId, d, extras) {
  const existentes = d.notas_fiscais || lerAba('NotasFiscais');
  const gravada = encontrarNotaGravada(lida, existentes);
  if (gravada) {
    const mudancas = { atualizada_em: agoraIso() };
    if (lida.situacao && lida.situacao !== gravada.situacao) {
      mudancas.situacao = lida.situacao;
      if (lida.situacao === 'cancelada' && gravada.lancamento_id) {
        try { atualizarPorId('Lancamentos', gravada.lancamento_id, { status: 'a_confirmar' }); } catch (e) { /* ignora */ }
        mudancas.destino = 'a_confirmar';
      }
    }
    if (detalhe && detalhe.itens && detalhe.itens.length && !gravada.itens) { mudancas.itens = JSON.stringify(detalhe.itens).slice(0, 45000); if (detalhe.chave_acesso) mudancas.chave_acesso = detalhe.chave_acesso; }
    const nova = atualizarPorId('NotasFiscais', gravada.id, mudancas) || gravada;
    return { acao: mudancas.situacao === 'cancelada' ? 'cancelada' : 'atualizada', nota: nova };
  }
  const linha = montarLinhaNota(lida, detalhe, usuarioId);
  if (linha.situacao !== 'normal') {
    linha.destino = 'ignorar';
    const n = inserirLinhas('NotasFiscais', [linha])[0];
    existentes.push(n);
    return { acao: 'guardada', nota: n };
  }
  const decisao = decidirConciliacao(linha, d, extras);
  linha.destino = decisao.destino;
  if (decisao.tipo === 'enriquecer') {
    const l = decisao.lancamento;
    const mudancas = {};
    if (linha.emitente && (!l.estabelecimento || normalizar(l.estabelecimento).length < normalizar(linha.emitente).length)) mudancas.estabelecimento = linha.emitente;
    if (Object.keys(mudancas).length) { try { atualizarPorId('Lancamentos', l.id, mudancas); } catch (e) { /* ignora */ } }
    linha.lancamento_id = l.id;
    const n = inserirLinhas('NotasFiscais', [linha])[0];
    existentes.push(n);
    return { acao: 'enriquecida', nota: n };
  }
  if (decisao.tipo === 'anexar_caixa') {
    const item = decisao.item;
    const mudancas = { texto_bruto: (String(item.texto_bruto || '') + ' · ' + textoCaixaDaNota(linha)).slice(0, 500) };
    if (item.status === 'aguardando_nota') { mudancas.status = 'pendente'; mudancas.valor = linha.valor; mudancas.data_compra = String(linha.data_emissao || item.data_compra || '').slice(0, 10) || item.data_compra; mudancas.estabelecimento = linha.emitente || item.estabelecimento; mudancas.canal = linha.fonte; }
    if (!item.estabelecimento && linha.emitente) mudancas.estabelecimento = linha.emitente;
    atualizarPorId('CaixaEntrada', item.id, mudancas);
    linha.caixa_id = item.id;
    const n = inserirLinhas('NotasFiscais', [linha])[0];
    existentes.push(n);
    return { acao: 'anexada', nota: n };
  }
  if (decisao.tipo === 'direto') {
    const data = String(linha.data_emissao || hojeIso()).slice(0, 10);
    const l = inserirLinhas('Lancamentos', [{
      id: gerarId('l'), data: data, competencia: competenciaDe(data), tipo: 'despesa', valor: linha.valor, categoria_id: decisao.categoria_id,
      descricao: linha.emitente, estabelecimento: linha.emitente, forma_pgto: formaPgtoDaNota(linha.forma_pgto), cartao_id: '', parcela: '',
      usuario_id: usuarioId, origem: linha.fonte, anexo_url: '', status: 'confirmado', hash_dedup: hashDedup(linha.valor, data, '', linha.emitente),
      criado_em: agoraIso(), editado_por: '', excluido: false, projeto_id: '',
    }])[0];
    d.lancamentos.push(l);
    linha.lancamento_id = l.id;
    const n = inserirLinhas('NotasFiscais', [linha])[0];
    existentes.push(n);
    return { acao: 'lancada', nota: n, lancamento: l, categoria_id: decisao.categoria_id };
  }
  if (decisao.tipo === 'guardar') {
    const n = inserirLinhas('NotasFiscais', [linha])[0];
    existentes.push(n);
    return { acao: 'guardada', nota: n };
  }
  // Caixa de Entrada (pendente ou a confirmar: Família / Empresa / Ignorar).
  const data = String(linha.data_emissao || hojeIso()).slice(0, 10);
  const item = inserirLinhas('CaixaEntrada', [{
    id: gerarId('ce'), recebido_em: agoraIso(), canal: linha.fonte, texto_bruto: textoCaixaDaNota(linha), valor: linha.valor, estabelecimento: linha.emitente,
    final_cartao: '', data_compra: data, sugestao_categoria: decisao.sugestoes[0] || 'c_imprevistos', sugestoes: decisao.sugestoes, usuario_id: usuarioId,
    status: 'pendente', lancamento_id: '', hash_dedup: hashDedup(linha.valor, data, '', linha.emitente),
  }])[0];
  d.caixa_entrada.push(item);
  linha.caixa_id = item.id;
  const n = inserirLinhas('NotasFiscais', [linha])[0];
  existentes.push(n);
  return { acao: decisao.destino === 'a_confirmar' ? 'a_confirmar' : 'caixa', nota: n, item: item };
}

// ---------- Aprendizado por CNPJ (seção 6) ----------

/** Grava a escolha Família/Empresa/Ignorar para o CNPJ (ou nome). Depois de 2 escolhas iguais vira regra. */
function aprenderDestinoNota(nota, destino, uid) {
  const regras = lerAba('RegrasLoja');
  const chaveNome = normalizar(nota.emitente);
  const cnpj = String(nota.cnpj || '').replace(/\D/g, '');
  let regra = cnpj ? regras.find(function (r) { return String(r.cnpj || '') === cnpj; }) : null;
  if (!regra && chaveNome) regra = regras.find(function (r) { return r.loja_normalizada === chaveNome; }) || null;
  if (regra) {
    const mesmo = (regra.destino || 'familia') === destino;
    return atualizarPorId('RegrasLoja', regra.id, { destino: destino, cnpj: regra.cnpj || cnpj, acertos: mesmo ? (Number(regra.acertos) || 0) + 1 : 1 });
  }
  if (!chaveNome && !cnpj) return null;
  return inserirLinhas('RegrasLoja', [{ id: gerarId('rl'), loja_normalizada: chaveNome, categoria_id: '', criado_por: uid || '', criado_em: agoraIso(), acertos: 1, destino: destino, cnpj: cnpj }])[0];
}

// ---------- Sincronização (seção 7) ----------

/** Meses da janela: mês atual + anterior ({ ano, mes, competencia }). */
function mesesDaJanela(quantos, hoje) {
  const comp = competenciaDe(hoje || hojeIso());
  const saida = [];
  for (let k = 0; k < (quantos || 2); k++) {
    const c = somarMeses(comp, -k);
    saida.push({ ano: Number(c.slice(0, 4)), mes: Number(c.slice(5, 7)), competencia: c });
  }
  return saida;
}

/** Registra uma falha de login; na 2ª seguida suspende a fonte e avisa o administrador. */
function registrarFalhaLogin(fonte, uid, motivo) {
  const estado = lerEstadoNotas(fonte, uid);
  const falhas = (Number(estado.falhas) || 0) + 1;
  const suspender = falhas >= NOTAS_MAX_FALHAS_LOGIN || motivo === 'desafio' || motivo === 'bloqueado';
  atualizarEstadoNotas(fonte, uid, { falhas: falhas, ultima_leitura: agoraIso(), motivo: motivo, suspenso: suspender });
  if (suspender) {
    const nome = FONTES_NOTAS[fonte].nome;
    const u = buscarPorId('Usuarios', uid);
    const texto = motivo === 'senha_invalida' ? 'A senha do ' + nome + ' de ' + (u ? u.apelido : uid) + ' parece ter mudado. Reconecte em Configurações → Notas fiscais.'
      : motivo === 'desafio' ? 'O ' + nome + ' passou a pedir um desafio (captcha) no login. O robô foi pausado para ' + (u ? u.apelido : uid) + '.'
      : motivo === 'bloqueado' || motivo === 'conexao_recusada' ? 'O ' + nome + ' não aceitou a conexão do robô (' + motivo + '). Veja o Plano B em docs/ROBO_NOTAS_FISCAIS.md.'
      : 'O robô do ' + nome + ' falhou 2 vezes seguidas para ' + (u ? u.apelido : uid) + ' (' + motivo + ') e foi pausado.';
    try { notificarPerfis(['Administrador'], 'Robô de notas fiscais pausado', texto, '#/configuracoes/notas-fiscais'); } catch (e) { console.warn('aviso: ' + e.message); }
  }
  return suspender;
}

/**
 * Sincroniza uma fonte para um membro. Devolve { ok, motivo, novas, atualizadas, lancadas, caixa, a_confirmar,
 * enriquecidas, canceladas, restantes, resumo_itens: [...] }.
 * `opcoes`: { meses (janela), maxDetalhes, prazoMs, historico (bool) }.
 */
function sincronizarFonteUsuario(fonte, uid, opcoes) {
  const o = opcoes || {};
  const inicio = Date.now();
  const r = { fonte: fonte, usuario_id: uid, ok: false, motivo: '', novas: 0, atualizadas: 0, lancadas: 0, caixa: 0, a_confirmar: 0, enriquecidas: 0, anexadas: 0, canceladas: 0, guardadas: 0, restantes: 0, itens: [] };
  const cred = lerCredencialFiscal(FONTES_NOTAS[fonte].prefixo, uid);
  if (!cred) { r.motivo = 'sem credencial'; return r; }
  const estado = lerEstadoNotas(fonte, uid);
  if (estado.suspenso && !o.forcar) { r.motivo = 'suspenso: ' + (estado.motivo || ''); return r; }
  const janela = o.meses || mesesDaJanela(2);
  const leitura = fonte === 'nota_parana' ? lerNotaParana(cred, janela) : lerNotaCuritibana(cred, janela.length);
  if (!leitura.ok) {
    r.motivo = leitura.motivo;
    registrarFalhaLogin(fonte, uid, leitura.motivo);
    return r;
  }
  atualizarEstadoNotas(fonte, uid, { falhas: 0, suspenso: false, motivo: '', ultimo_ok: agoraIso() });
  const d = carregarDados();
  d.caixa_entrada = lerAba('CaixaEntrada');
  d.notas_fiscais = lerAba('NotasFiscais');
  const comp = competenciaDe();
  const padrao = mesForaDoPadraoNotas(d.notas_fiscais.concat(leitura.notas.map(function (n) { return { usuario_id: uid, situacao: n.situacao, destino: '', data_emissao: n.data_emissao, valor: n.valor }; })), uid, comp);
  const extras = { mes_fora_do_padrao: padrao.fora };
  if (padrao.fora) {
    try { guardarAviso({ id: 'av_nf_padrao_' + uid + '_' + comp, data: hojeIso(), tipo: 'fora_do_padrao', titulo: 'Mês com notas fora do padrão', detalhe: 'As notas fiscais de ' + nomeMes(comp) + ' somam ' + moeda(padrao.total) + ', contra uma média de ' + moeda(padrao.media) + ' — parece haver compras da empresa. Confira na Caixa de Entrada.', gravidade: 'warn', acao: { rotulo: 'abrir', rota: '/caixa' } }, uid); } catch (e) { /* ignora */ }
  }
  const maxDetalhes = o.maxDetalhes || NOTAS_MAX_DETALHES_POR_EXECUCAO;
  const prazo = o.prazoMs || NOTAS_TEMPO_MAXIMO_MS;
  let detalhesBaixados = 0;
  leitura.notas.forEach(function (lida) {
    const gravada = encontrarNotaGravada(lida, d.notas_fiscais);
    if (gravada) {
      if (lida.situacao !== gravada.situacao) { const p = processarNota(lida, null, uid, d, extras); r.atualizadas++; if (p.acao === 'cancelada') { r.canceladas++; r.itens.push({ acao: 'cancelada', emitente: gravada.emitente, valor: gravada.valor }); } }
      return;
    }
    if (detalhesBaixados >= maxDetalhes || Date.now() - inicio > prazo) { r.restantes++; return; }
    let detalhe = null;
    if (fonte === 'nota_parana' && lida.situacao === 'normal') {
      pausaEntreRequisicoes();
      try { detalhe = lerDanfeNotaParana(leitura.pote, lida.tp_doc, lida.id_portal); } catch (e) { detalhe = null; }
      detalhesBaixados++;
    }
    const p = processarNota(lida, detalhe, uid, d, extras);
    r.novas++;
    if (p.acao === 'lancada') r.lancadas++;
    else if (p.acao === 'caixa') r.caixa++;
    else if (p.acao === 'a_confirmar') r.a_confirmar++;
    else if (p.acao === 'enriquecida') r.enriquecidas++;
    else if (p.acao === 'anexada') r.anexadas++;
    else if (p.acao === 'guardada') r.guardadas++;
    r.itens.push({ acao: p.acao, emitente: p.nota.emitente, valor: p.nota.valor, lancamento_id: p.lancamento ? p.lancamento.id : '', categoria_id: p.categoria_id || '' });
  });
  // Mais de metade dos detalhes vazios → o portal mudou o HTML.
  const vazios = r.itens.filter(function (i) { return i.acao !== 'cancelada' && !(i.valor > 0); }).length;
  if (fonte === 'nota_parana' && r.novas >= 4 && vazios > r.novas / 2) {
    atualizarEstadoNotas(fonte, uid, { suspenso: true, motivo: 'html_mudou' });
    try { notificarPerfis(['Administrador'], 'O Nota Paraná mudou', 'A leitura veio vazia em mais da metade das notas. O robô precisa de ajuste e foi pausado.', '#/configuracoes/notas-fiscais'); } catch (e) { /* ignora */ }
  }
  r.ok = true;
  r.motivo = 'ok';
  atualizarEstadoNotas(fonte, uid, { ultima_leitura: agoraIso(), notas_novas: r.novas, restantes: r.restantes });
  return r;
}

/** Monta a frase do resumo: "3 notas novas · R$ 2.531,48 · 1 para confirmar (Filtros Curitiba, R$ 2.104,69: Família ou Empresa?)". */
function resumoSincronizacao(resultados) {
  const novas = resultados.filter(function (i) { return i.acao !== 'cancelada' && i.acao !== 'atualizada'; });
  if (!novas.length) return '';
  const total = somar(novas, function (i) { return i.valor; });
  const partes = [novas.length + ' nota' + (novas.length === 1 ? ' nova' : 's novas'), moeda(total)];
  const confirmar = novas.filter(function (i) { return i.acao === 'a_confirmar'; });
  if (confirmar.length) partes.push(confirmar.length + ' para confirmar (' + confirmar.slice(0, 2).map(function (i) { return i.emitente + ', ' + moeda(i.valor) + ': Família ou Empresa?'; }).join('; ') + ')');
  const lancadas = novas.filter(function (i) { return i.acao === 'lancada'; });
  if (lancadas.length) partes.push(lancadas.length + ' lançada' + (lancadas.length === 1 ? '' : 's') + ' direto (' + lancadas.slice(0, 3).map(function (i) { return i.emitente; }).join(', ') + ') — para desfazer, abra o lançamento');
  const caixa = novas.filter(function (i) { return i.acao === 'caixa' || i.acao === 'anexada'; });
  if (caixa.length) partes.push(caixa.length + ' na Caixa de Entrada');
  return partes.join(' · ');
}

/**
 * Rotina do gatilho (a cada 6 h e às 21h): sincroniza todas as fontes de todos os membros com credencial.
 * `opcoes.usuario_id` restringe a um membro; `opcoes.fonte` a uma fonte. Devolve o resumo por membro.
 */
function sincronizarNotasFiscais(opcoes) {
  const o = opcoes || {};
  const cfg = lerConfig();
  if (cfg.rotina_notas === false && !o.forcar) { console.log('sincronizarNotasFiscais: rotina desligada na Config'); return []; }
  const saida = [];
  Object.keys(FONTES_NOTAS).forEach(function (fonte) {
    if (o.fonte && o.fonte !== fonte) return;
    listarUsuariosComCredencial(FONTES_NOTAS[fonte].prefixo).forEach(function (uid) {
      if (o.usuario_id && o.usuario_id !== uid) return;
      let r;
      try { r = sincronizarFonteUsuario(fonte, uid, o); } catch (e) { r = { fonte: fonte, usuario_id: uid, ok: false, motivo: 'erro: ' + textoSeguroParaLog(e.message), itens: [] }; console.error('sincronizar ' + fonte + ': ' + textoSeguroParaLog(e.message)); }
      saida.push(r);
      if (r.ok && r.itens.length && !o.silencioso) {
        const texto = resumoSincronizacao(r.itens);
        if (texto) { try { notificarUsuario(uid, FONTES_NOTAS[fonte].nome + ': ' + texto.split(' · ')[0], texto, '#/caixa'); } catch (e) { console.warn('aviso: ' + e.message); } }
      }
    });
  });
  const totalNovas = somar(saida, function (r) { return r.novas || 0; });
  console.log('sincronizarNotasFiscais: ' + saida.length + ' leitura(s), ' + totalNovas + ' nota(s) nova(s)');
  return saida;
}

// ---------- Busca por loja (seção 8) ----------

/** Nome aproximado: "Condor" casa com "CONDOR SUPER CENTER LTDA"; também pelo CNPJ das RegrasLoja (função pura). */
function notaCombinaComLoja(nota, loja, regras) {
  const alvo = normalizar(loja);
  if (!alvo) return false;
  const emitente = normalizar(nota.emitente);
  if (emitente.indexOf(alvo) >= 0) return true;
  const palavras = alvo.split(' ').filter(function (p) { return p.length >= 3; });
  if (palavras.length && palavras.every(function (p) { return emitente.indexOf(p) >= 0; })) return true;
  const regra = (regras || []).find(function (r) { return r.loja_normalizada && (r.loja_normalizada === alvo || r.loja_normalizada.indexOf(alvo) >= 0) && r.cnpj; });
  return !!(regra && nota.cnpj && String(regra.cnpj) === String(nota.cnpj));
}

/** Filtra as notas do usuário pela loja (e data ±3 dias / valor ±0,01, se informados). Função pura. */
function filtrarNotasPorLoja(notas, usuarioId, loja, data, valor, regras) {
  return (notas || []).filter(function (n) {
    if (n.usuario_id !== usuarioId || n.situacao === 'cancelada' || n.destino === 'empresa' || n.destino === 'ignorar') return false;
    if (!notaCombinaComLoja(n, loja, regras)) return false;
    if (data && Math.abs(diferencaDias(String(n.data_emissao).slice(0, 10), data)) > 3) return false;
    if (valor > 0 && Math.abs(Number(n.valor) - Number(valor)) > 0.011) return false;
    return true;
  }).sort(function (a, b) { return a.data_emissao < b.data_emissao ? 1 : -1; });
}

/** "hoje 18:42" / "ontem" / "03/11 18:42" para a resposta falada. */
function quandoDaNota(dataEmissao, hoje) {
  const h = hoje || hojeIso();
  const dia = String(dataEmissao || '').slice(0, 10);
  const hora = String(dataEmissao || '').slice(11, 16);
  const dif = diferencaDias(h, dia);
  const quando = dif === 0 ? 'hoje' : dif === 1 ? 'ontem' : dataBr(dia);
  return quando + (hora ? ' ' + hora : '');
}

/**
 * Procura a compra de uma loja nas notas do usuário e lança/enriquece (seção 8). Devolve
 * { status: 'lancado'|'varias'|'aguardando'|'pendente', texto, lancamento?, notas?, item? }.
 */
function buscarNotaFiscalParaUsuario(ctx, loja, data, valor, sincronizar) {
  const l = String(loja || '').trim();
  if (!l) throw new ErroUsuario('Diga o nome da loja.');
  const uid = ctx.uid;
  const regras = lerAba('RegrasLoja');
  let notas = filtrarNotasPorLoja(lerAba('NotasFiscais'), uid, l, data, valor, regras);
  const temCredencial = Object.keys(FONTES_NOTAS).some(function (f) { return !!lerCredencialFiscal(FONTES_NOTAS[f].prefixo, uid); });
  if (!notas.length && sincronizar !== false && temCredencial) {
    try { sincronizarNotasFiscais({ usuario_id: uid, meses: mesesDaJanela(1), maxDetalhes: 15, silencioso: true, forcar: true }); } catch (e) { console.warn('sincronizar: ' + textoSeguroParaLog(e.message)); }
    notas = filtrarNotasPorLoja(lerAba('NotasFiscais'), uid, l, data, valor, regras);
  }
  const naoResolvidas = notas.filter(function (n) { return !n.lancamento_id; });
  if (naoResolvidas.length === 1 || (naoResolvidas.length === 0 && notas.length === 1)) {
    const n = naoResolvidas[0] || notas[0];
    return lancarNotaEncontrada(ctx, n);
  }
  if (notas.length > 1) {
    return { status: 'varias', texto: 'Encontrei ' + notas.length + ' compras em ' + l + ': ' + notas.slice(0, 5).map(function (n) { return quandoDaNota(n.data_emissao) + ' ' + moeda(n.valor) + (n.lancamento_id ? ' (já lançada)' : ''); }).join('; ') + '. Qual delas?', notas: notas.slice(0, 5).map(notaFiscalResumo) };
  }
  // Nenhuma: cria a espera na Caixa.
  const dataCompra = data || hojeIso();
  const jaEspera = lerAba('CaixaEntrada').find(function (c) { return c.status === 'aguardando_nota' && c.usuario_id === uid && normalizar(c.estabelecimento) === normalizar(l); });
  const item = jaEspera || inserirLinhas('CaixaEntrada', [{
    id: gerarId('ce'), recebido_em: agoraIso(), canal: 'nota_parana', texto_bruto: 'Compra dita por voz/assistente: aguardando a nota fiscal', valor: valor > 0 ? lerValor(valor) : 0, estabelecimento: l,
    final_cartao: '', data_compra: dataCompra, sugestao_categoria: aplicarRegraLoja(l, sugerirCategoria(l, lerAba('Categorias')), regras)[0] || 'c_imprevistos',
    sugestoes: aplicarRegraLoja(l, sugerirCategoria(l, lerAba('Categorias')), regras), usuario_id: uid, status: 'aguardando_nota', lancamento_id: '', hash_dedup: '',
  }])[0];
  const texto = temCredencial
    ? 'A nota de ' + l + ' ainda não apareceu no ' + (FONTES_NOTAS.nota_parana.nome) + '. Vou procurar de novo às 21h e te aviso. Se quiser, me diga o valor que eu lanço agora e junto com a nota depois.'
    : 'Ainda não há conexão com o Nota Paraná para buscar a nota de ' + l + '. Um administrador conecta em Configurações → Notas fiscais. Se quiser, me diga o valor que eu lanço agora.';
  return { status: 'aguardando', texto: texto, item: itemCaixaPublico(item) };
}

/** Lança (ou enriquece) a nota encontrada e monta a frase da resposta. */
function lancarNotaEncontrada(ctx, nota) {
  const d = carregarDados();
  d.caixa_entrada = lerAba('CaixaEntrada');
  const cats = indexarPorId(d.categorias);
  let itens = [];
  try { itens = nota.itens ? JSON.parse(nota.itens) : []; } catch (e) { itens = []; }
  if (nota.lancamento_id) {
    const l = buscarPorId('Lancamentos', nota.lancamento_id);
    const cat = l ? cats[l.categoria_id] : null;
    return { status: 'lancado', texto: nota.emitente + ', ' + quandoDaNota(nota.data_emissao) + ', ' + moeda(nota.valor) + (itens.length ? ', ' + itens.length + ' itens' : '') + '. Essa compra já estava lançada' + (cat ? ' em ' + cat.nome : '') + '.', lancamento: l ? lancamentoPublico(l) : undefined, nota: notaFiscalResumo(nota) };
  }
  const regras = d.regras_loja;
  const sugestoes = aplicarRegraLoja(nota.emitente, sugerirCategoria(nota.emitente + ' ' + textoDosItens(itens, 10), d.categorias), regras);
  const categoriaId = sugestoes[0] || 'c_imprevistos';
  const data = String(nota.data_emissao || hojeIso()).slice(0, 10);
  const l = acaoSalvarLancamento({ lancamento: { valor: nota.valor, data: data, categoria_id: categoriaId, descricao: nota.emitente, estabelecimento: nota.emitente, forma_pgto: formaPgtoDaNota(nota.forma_pgto), origem: nota.fonte, usuario_id: nota.usuario_id || ctx.uid } }, ctx)[0];
  const mudancas = { lancamento_id: l.id, destino: 'familia', atualizada_em: agoraIso() };
  if (nota.caixa_id) { try { atualizarPorId('CaixaEntrada', nota.caixa_id, { status: 'lançado', lancamento_id: l.id }); } catch (e) { /* ignora */ } }
  atualizarPorId('NotasFiscais', nota.id, mudancas);
  const cat = cats[categoriaId];
  return { status: 'lancado', texto: nota.emitente + ', ' + quandoDaNota(nota.data_emissao) + ', ' + moeda(nota.valor) + (itens.length ? ', ' + itens.length + ' itens' : '') + '. Lancei em ' + (cat ? cat.nome : 'Imprevistos') + '. Era da família toda?', lancamento: l, nota: notaFiscalResumo(Object.assign({}, nota, mudancas)) };
}

/** Frase "comprei no Condor" sem valor → loja (função pura). Devolve '' quando a frase tem valor ou não é de compra. */
function lojaDeFraseSemValor(texto) {
  const t = String(texto || '').trim();
  if (!t || extrairValor(t) > 0) return '';
  const m = t.match(/^(?:eu\s+)?(?:comprei|gastei|paguei|passei|fiz\s+compra)\s+(?:hoje|ontem|agora|de\s+manh[aã]|à\s+tarde|à\s+noite)?\s*(?:no|na|em|do|da|nos|nas)\s+(.+?)(?:[,;]?\s+(?:hoje|ontem|agora|com\s+cpf|na\s+nota|pedi\s+cpf).*)?[.!?,;]*$/i);
  if (!m) return '';
  const loja = m[1].replace(/\b(cpf|nota|cart[aã]o|cr[eé]dito|d[eé]bito|pix|dinheiro)\b.*$/i, '').replace(/[,.;!?]+$/, '').trim().replace(/(?:\s+(?:no|na|em|com|de|do|da|nos|nas))+$/i, '').trim();
  return loja.length >= 3 ? loja : '';
}

// ---------- Ações da API (seção 9) ----------

/** status_notas_fiscais (Adulto): conexões, última leitura, contagens e erros — nunca a credencial. */
function acaoStatusNotasFiscais(p, ctx) {
  const notas = lerAba('NotasFiscais');
  const usuarios = lerAba('Usuarios').filter(function (u) { return u.ativo && normalizarPerfil(u.perfil) !== 'Dependente'; });
  const conexoes = [];
  usuarios.forEach(function (u) {
    Object.keys(FONTES_NOTAS).forEach(function (fonte) {
      const tem = !!lerCredencialFiscal(FONTES_NOTAS[fonte].prefixo, u.id);
      const estado = lerEstadoNotas(fonte, u.id);
      const minhas = notas.filter(function (n) { return n.fonte === fonte && n.usuario_id === u.id; });
      conexoes.push({ fonte: fonte, nome_fonte: FONTES_NOTAS[fonte].nome, usuario_id: u.id, conectado: tem, conectado_em: estado.conectado_em || '', ultima_leitura: estado.ultima_leitura || '', ultimo_ok: estado.ultimo_ok || '', notas_novas: Number(estado.notas_novas) || 0, suspenso: !!estado.suspenso, motivo: estado.motivo || '', falhas: Number(estado.falhas) || 0, total_notas: minhas.length, restantes: Number(estado.restantes) || 0 });
    });
  });
  const comp = competenciaDe();
  const doMes = notas.filter(function (n) { return String(n.data_emissao || '').slice(0, 7) === comp && n.situacao !== 'cancelada'; });
  const cfg = lerConfig();
  return {
    conexoes: conexoes,
    contagens: { total: notas.length, mes: doMes.length, valor_mes: arredondar(somar(doMes, function (n) { return n.valor; })), a_confirmar: notas.filter(function (n) { return n.destino === 'a_confirmar'; }).length, empresa: notas.filter(function (n) { return n.destino === 'empresa'; }).length },
    limites: { direto: Number(cfg.notas_limite_direto) || 500, grande: Number(cfg.notas_limite_grande) || 1500 },
    rotina_ativa: cfg.rotina_notas !== false,
  };
}

/** listar_notas_fiscais (Adulto): notas do mês (ou da competência pedida), resumidas. Dependente não chega aqui. */
function acaoListarNotasFiscais(p, ctx) {
  const comp = p.competencia || competenciaDe();
  let notas = lerAba('NotasFiscais').filter(function (n) { return String(n.data_emissao || '').slice(0, 7) === comp; });
  if (p.usuario_id_filtro) notas = notas.filter(function (n) { return n.usuario_id === p.usuario_id_filtro; });
  if (p.destino) notas = notas.filter(function (n) { return n.destino === p.destino; });
  return notas.sort(function (a, b) { return a.data_emissao < b.data_emissao ? 1 : -1; }).slice(0, Number(p.limite) || 200).map(notaFiscalResumo);
}

/** salvar_credencial_fiscal (Admin): grava a credencial (somente escrita) para um usuário/fonte. */
function acaoSalvarCredencialFiscal(p, ctx) {
  const fonte = String(p.fonte || 'nota_parana');
  const uid = String(p.usuario_id_alvo || p.usuario_alvo || ctx.uid);
  const u = buscarPorId('Usuarios', uid);
  if (!u || normalizarPerfil(u.perfil) === 'Dependente') throw new ErroUsuario('Escolha um membro adulto.');
  const cred = prepararCredencialFiscal(fonte, p.credencial || p);
  gravarCredencialFiscal(fonte, uid, cred);
  atualizarEstadoNotas(fonte, uid, { conectado_em: agoraIso(), falhas: 0, suspenso: false, motivo: '' });
  return { ok: true, fonte: fonte, usuario_id: uid, conectado_em: agoraIso() };
}

/** remover_credencial_fiscal (Admin): apaga a propriedade. */
function acaoRemoverCredencialFiscal(p, ctx) {
  const fonte = String(p.fonte || 'nota_parana');
  const uid = String(p.usuario_id_alvo || p.usuario_alvo || ctx.uid);
  apagarCredencialFiscal(fonte, uid);
  return { ok: true, fonte: fonte, usuario_id: uid };
}

/** testar_credencial_fiscal (Admin): login + leitura do resumo do mês. Devolve só o resultado classificado. */
function acaoTestarCredencialFiscal(p, ctx) {
  const fonte = String(p.fonte || 'nota_parana');
  const uid = String(p.usuario_id_alvo || p.usuario_alvo || ctx.uid);
  const cred = lerCredencialFiscal(FONTES_NOTAS[fonte].prefixo, uid);
  if (!cred) throw new ErroUsuario('Este membro ainda não está conectado ao ' + FONTES_NOTAS[fonte].nome + '.');
  const hoje = new Date();
  if (fonte === 'nota_parana') {
    const login = loginNotaParana(cred);
    if (!login.ok) { registrarFalhaLogin(fonte, uid, login.motivo); return { ok: false, etapa: login.etapa, motivo: login.motivo, dica: dicaFase0(login.motivo), caminho: login.saltos }; }
    const lista = listarNotasMesNotaParana(login.pote, hoje.getFullYear(), hoje.getMonth() + 1);
    atualizarEstadoNotas(fonte, uid, { falhas: 0, suspenso: false, motivo: '', ultimo_ok: agoraIso() });
    return { ok: lista.classe === 'ok', motivo: lista.classe, quantidade: lista.quantidade, competencia: competenciaDe(), texto: lista.classe === 'ok' ? 'login ok · ' + lista.quantidade + ' notas em ' + zeros(hoje.getMonth() + 1, 2) + '/' + hoje.getFullYear() : 'login ok, mas a lista voltou "' + lista.classe + '"' };
  }
  const login = loginNotaCuritibana(cred);
  if (!login.ok) { registrarFalhaLogin(fonte, uid, login.motivo); return { ok: false, etapa: login.etapa, motivo: login.motivo, dica: dicaFase0(login.motivo), caminho: login.saltos }; }
  const meses = lerMesesNotaCuritibana(login.pote, 1);
  atualizarEstadoNotas(fonte, uid, { falhas: 0, suspenso: false, motivo: '', ultimo_ok: agoraIso() });
  return { ok: meses.ok, motivo: meses.ok ? 'ok' : 'lista', quantidade: meses.notas.length, competencia: competenciaDe(), texto: meses.ok ? 'login ok · ' + meses.notas.length + ' notas no último mês disponível' : 'login ok, mas não li a lista de meses' };
}

/** sincronizar_notas (Adulto): roda agora para o próprio usuário; o Admin pode rodar para todos. */
function acaoSincronizarNotas(p, ctx) {
  const todos = ctx.ehAdmin && paraBooleano(p.todos);
  const resultados = sincronizarNotasFiscais({ usuario_id: todos ? '' : ctx.uid, fonte: p.fonte || '', forcar: true, silencioso: !paraBooleano(p.notificar) });
  return resultados.map(function (r) { return { fonte: r.fonte, usuario_id: r.usuario_id, ok: r.ok, motivo: r.motivo, novas: r.novas || 0, lancadas: r.lancadas || 0, caixa: (r.caixa || 0) + (r.anexadas || 0), a_confirmar: r.a_confirmar || 0, enriquecidas: r.enriquecidas || 0, canceladas: r.canceladas || 0, restantes: r.restantes || 0, resumo: r.ok ? (resumoSincronizacao(r.itens || []) || 'Nenhuma nota nova.') : r.motivo }; });
}

/** buscar_nota_fiscal (Adulto): busca por loja/data/valor — usada pelo Assistente e pela voz. */
function acaoBuscarNotaFiscal(p, ctx) {
  const data = p.data ? normalizarDataIso(p.data) : '';
  return buscarNotaFiscalParaUsuario(ctx, p.loja, data, lerValor(p.valor), p.sincronizar !== false && p.sincronizar !== 'false');
}

/**
 * definir_destino_nota (Adulto): familia (lança, com categoria opcional) · empresa · ignorar; aprende para o CNPJ.
 * Devolve { nota, item } (item da Caixa atualizado, quando houver).
 */
function acaoDefinirDestinoNota(p, ctx) {
  const destino = String(p.destino || '');
  if (['familia', 'empresa', 'ignorar'].indexOf(destino) < 0) throw new ErroUsuario('Destino inválido (familia, empresa ou ignorar).');
  let nota = p.nota_id ? buscarPorId('NotasFiscais', String(p.nota_id)) : null;
  if (!nota && p.caixa_id) nota = lerAba('NotasFiscais').find(function (n) { return n.caixa_id === String(p.caixa_id); }) || null;
  if (!nota) throw new ErroUsuario('Nota não encontrada.');
  if (ctx.ehDependente && nota.usuario_id !== ctx.uid) throw new ErroUsuario('Sem permissão');
  try { aprenderDestinoNota(nota, destino, ctx.uid); } catch (e) { console.warn('Não gravei o destino da loja: ' + e.message); }
  let item = nota.caixa_id ? buscarPorId('CaixaEntrada', nota.caixa_id) : null;
  if (destino === 'familia') {
    const d = carregarDados();
    let itens = [];
    try { itens = nota.itens ? JSON.parse(nota.itens) : []; } catch (e) { itens = []; }
    const sugestoes = aplicarRegraLoja(nota.emitente, sugerirCategoria(nota.emitente + ' ' + textoDosItens(itens, 10), d.categorias), d.regras_loja);
    const categoriaId = String(p.categoria_id || (item && item.sugestao_categoria) || sugestoes[0] || 'c_imprevistos');
    if (!buscarPorId('Categorias', categoriaId)) throw new ErroUsuario('Categoria não encontrada.');
    if (nota.lancamento_id) {
      atualizarPorId('NotasFiscais', nota.id, { destino: 'familia', atualizada_em: agoraIso() });
      if (item) item = atualizarPorId('CaixaEntrada', item.id, { status: 'lançado', lancamento_id: nota.lancamento_id });
    } else {
      const data = String(nota.data_emissao || hojeIso()).slice(0, 10);
      const l = acaoSalvarLancamento({ lancamento: { valor: nota.valor, data: data, categoria_id: categoriaId, descricao: p.descricao || nota.emitente, estabelecimento: nota.emitente, forma_pgto: formaPgtoDaNota(nota.forma_pgto), origem: nota.fonte, usuario_id: nota.usuario_id || ctx.uid }, aprender_loja: item && item.sugestao_categoria && item.sugestao_categoria !== categoriaId }, ctx)[0];
      nota = atualizarPorId('NotasFiscais', nota.id, { destino: 'familia', lancamento_id: l.id, atualizada_em: agoraIso() });
      if (item) item = atualizarPorId('CaixaEntrada', item.id, { status: 'lançado', lancamento_id: l.id });
    }
  } else {
    if (nota.lancamento_id) {
      // Já estava lançada como da família e agora é empresa/ignorar: tira do painel da casa (soft delete).
      try { atualizarPorId('Lancamentos', nota.lancamento_id, { excluido: true, editado_por: ctx.uid }); } catch (e) { /* ignora */ }
    }
    nota = atualizarPorId('NotasFiscais', nota.id, { destino: destino, atualizada_em: agoraIso() });
    if (item) item = atualizarPorId('CaixaEntrada', item.id, { status: 'ignorado' });
  }
  nota = buscarPorId('NotasFiscais', nota.id) || nota;
  return { nota: notaFiscalResumo(nota), item: item ? itemCaixaPublico(item, nota) : null };
}

/** importar_historico_notas (Admin): importa até 12 meses, em lotes (um mês por chamada, do mais recente para trás). */
function acaoImportarHistoricoNotas(p, ctx) {
  const uid = String(p.usuario_id_alvo || p.usuario_alvo || ctx.uid);
  const fonte = String(p.fonte || 'nota_parana');
  const mesesAtras = Math.min(12, Math.max(1, Number(p.meses_atras) || 3));
  const comp = somarMeses(competenciaDe(), -mesesAtras);
  const janela = [{ ano: Number(comp.slice(0, 4)), mes: Number(comp.slice(5, 7)), competencia: comp }];
  const r = sincronizarFonteUsuario(fonte, uid, { meses: janela, maxDetalhes: Number(p.max_detalhes) || NOTAS_MAX_DETALHES_POR_EXECUCAO, forcar: true });
  return { competencia: comp, ok: r.ok, motivo: r.motivo, novas: r.novas || 0, restantes: r.restantes || 0, proximo_meses_atras: r.restantes ? mesesAtras : mesesAtras + 1, concluido: !r.restantes && mesesAtras >= 12, resumo: r.ok ? (resumoSincronizacao(r.itens || []) || 'Nenhuma nota nova em ' + nomeCompetencia(comp) + '.') : r.motivo };
}

// ---------- Webhook do Plano B: ?webhook=notas ----------

/**
 * Recebe notas de um coletor externo (GitHub Actions + Playwright, ou um computador no Brasil):
 * POST { token_familia, token, notas: [{ fonte, chave_acesso, id_portal, tp_doc, cnpj, emitente, data_emissao, valor,
 * frete, desconto, forma_pgto, itens, situacao }] }. Concilia cada nota como a sincronização faria.
 */
function tratarWebhookNotas(p) {
  validarTokenFamilia(p.token_familia);
  const usuario = usuarioPorToken(String(p.token || ''));
  if (!usuario || !usuario.ativo) throw new ErroUsuario('Sessão expirada');
  if (normalizarPerfil(usuario.perfil) === 'Dependente') throw new ErroUsuario('Sem permissão');
  let notas = p.notas;
  if (typeof notas === 'string') { try { notas = JSON.parse(notas); } catch (e) { throw new ErroUsuario('O campo notas não é um JSON válido.'); } }
  if (!Array.isArray(notas)) throw new ErroUsuario('Envie uma lista em notas.');
  const d = carregarDados();
  d.caixa_entrada = lerAba('CaixaEntrada');
  d.notas_fiscais = lerAba('NotasFiscais');
  const itens = [];
  notas.slice(0, 100).forEach(function (n) {
    const fonte = FONTES_NOTAS[n.fonte] ? n.fonte : 'nota_parana';
    const lida = { fonte: fonte, id_portal: String(n.id_portal || n.chave_acesso || ''), tp_doc: String(n.tp_doc || (fonte === 'nota_curitibana' ? 'nfse' : '2')), cnpj: cnpjSoDigitos(n.cnpj), emitente: String(n.emitente || ''), data_emissao: String(n.data_emissao || ''), valor: lerValor(n.valor), situacao: situacaoNota(n.situacao || 'normal'), chave_acesso: String(n.chave_acesso || '').replace(/\D/g, '') };
    if (!lida.id_portal) return;
    const detalhe = { chave_acesso: lida.chave_acesso, cnpj: lida.cnpj, emitente: lida.emitente, data_emissao: lida.data_emissao, valor: lida.valor, frete: lerValor(n.frete), desconto: lerValor(n.desconto), forma_pgto: String(n.forma_pgto || ''), itens: Array.isArray(n.itens) ? n.itens.map(function (i) { return itemNota(i.d || i.descricao, i.c || i.codigo, lerValor(i.q || i.qtde), i.un || i.unidade, lerValor(i.vu || i.valor_unitario), lerValor(i.vt || i.valor_total)); }) : [] };
    const r = processarNota(lida, detalhe, usuario.id, d, {});
    itens.push({ acao: r.acao, emitente: r.nota.emitente, valor: r.nota.valor });
  });
  atualizarEstadoNotas('nota_parana', usuario.id, { ultima_leitura: agoraIso(), ultimo_ok: agoraIso(), notas_novas: itens.filter(function (i) { return i.acao !== 'atualizada' && i.acao !== 'cancelada'; }).length, motivo: 'webhook' });
  const resumo = resumoSincronizacao(itens);
  if (resumo) { try { notificarUsuario(usuario.id, 'Notas fiscais: ' + resumo.split(' · ')[0], resumo, '#/caixa'); } catch (e) { /* ignora */ } }
  return { recebidas: notas.length, processadas: itens.length, resumo: resumo };
}
