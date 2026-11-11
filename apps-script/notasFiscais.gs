/**
 * notasFiscais.gs — Robô de Notas Fiscais (Nota Paraná + Nota Curitibana).
 *
 * Especificação: docs/ROBO_NOTAS_FISCAIS.md. Este arquivo cobre a **Fase 0 (prova de conceito)**:
 * entrar no portal pelo UrlFetchApp (sem navegador), seguindo os saltos do OAuth à mão e guardando
 * os cookies, e contar as notas do mês. O resultado decide entre o Plano A (tudo no Apps Script) e o
 * Plano B (GitHub Actions + Playwright).
 *
 * Regra de ouro: CPF, senha, cookies, tokens e códigos do OAuth NUNCA vão para log, planilha, Git
 * ou mensagem. As funções de teste imprimem só "login ok · N notas em MM/AAAA" ou o motivo da
 * falha (classificado, sem dados). Os cookies vivem apenas na memória desta execução.
 *
 * As funções puras (parse de URL/HTML, cookies, classificação da resposta) ficam no topo e são
 * testadas em testes/executar.mjs com amostras anonimizadas em testes/amostras/.
 */

// ---------- Endereços ----------

/** Aplicação do Nota Paraná (a lista e o DANFE ficam aqui, atrás do login). */
const NOTAPR_URL_BASE = 'https://notaparana.pr.gov.br';
const NOTAPR_URL_ENTRADA = NOTAPR_URL_BASE + '/nfprweb/Extrato';
const NOTAPR_URL_LISTA = NOTAPR_URL_BASE + '/nfprweb/NotasFiscaisAjax';
/** Identidade Digital Sefa/PR (OAuth authorization code + PKCE; o formulário é authentication.jsp). */
const SEFA_AUTHZ_HOST = 'authz-sefa.identidadedigital.pr.gov.br';
/** Nota Curitibana: o botão "Acessar" faz POST em /Home/CheckLogin e cai no e-Cidadão da Prefeitura. */
const NOTACWB_URL_BASE = 'https://notacuritibana.curitiba.pr.gov.br';
const NOTACWB_URL_CHECKLOGIN = NOTACWB_URL_BASE + '/Home/CheckLogin';
/** Máximo de saltos (redirecionamentos) seguidos numa sequência. */
const NOTAS_MAX_SALTOS = 12;
/** Prefixos das credenciais nas Propriedades do script (uma por membro adulto). */
const PREFIXO_CRED_NOTAPR = 'NOTAPR_';
const PREFIXO_CRED_NOTACWB = 'NOTACWB_';

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

/** Período como o portal espera: `01/MM/AAAA`. */
function periodoNotaPr(ano, mes) {
  return '01/' + zeros(mes, 2) + '/' + ano;
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
 * Para no primeiro 2xx/4xx/5xx ou quando chega na página de login da Sefa. Devolve a última resposta
 * mais `saltos` (lista de hosts visitados, sem query string — serve para o relatório).
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

// ---------- Credenciais (só leitura das Propriedades do script) ----------

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

// ---------- Nota Paraná: login e lista do mês ----------

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

/** Com a sessão aberta, lê a lista do mês (`NotasFiscaisAjax`) e devolve { status, quantidade, classe }. */
function listarNotasMesNotaParana(pote, ano, mes) {
  const url = NOTAPR_URL_LISTA + '?periodo=' + encodeURIComponent(periodoNotaPr(ano, mes)) + '&situacao=1';
  const r = requisicaoPortal(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: NOTAPR_URL_ENTRADA } }, pote);
  return { status: r.status, quantidade: contarNotasPr(r.texto), classe: classificarRespostaPortal(r.status, r.texto, url), tamanho: r.texto.length };
}

/**
 * FASE 0 — Prova de conceito do Nota Paraná. Rode no editor do Apps Script e veja o Registro de execução.
 * Antes, crie a propriedade do script `NOTAPR_<usuario_id>` com `{"cpf":"...","senha":"..."}`
 * (Configurações do projeto → Propriedades do script). Sem argumento, usa a primeira credencial encontrada.
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
  if (motivo === 'conexao_recusada' || motivo === 'bloqueado') return '→ O portal não aceita conexões do IP do Google: seguir pelo Plano B (GitHub Actions + Playwright) ou rodar o robô de um computador no Brasil.';
  if (motivo === 'desafio') return '→ O portal pede captcha/desafio: Plano B, ou aguardar; o QR Code da NFC-e continua funcionando.';
  if (motivo === 'senha_invalida') return '→ Confira CPF e senha na propriedade do script (o robô não tenta de novo para não bloquear a conta).';
  return '→ Guarde esta saída (ela não tem dados pessoais) e mande para ajustar o robô.';
}

// ---------- Nota Curitibana: mapeamento do login (e-Cidadão) ----------

/**
 * FASE 0 — Nota Curitibana. Mapeia o caminho de login SEM credencial: GET na home → POST /Home/CheckLogin
 * (com o token antifalsificação) → redireciona para o e-Cidadão da Prefeitura. Relata até onde dá para
 * chegar do IP do Google e se a página final pede captcha/desafio (no mapeamento de 11/11/2026 o
 * e-Cidadão carregava o ALTCHA, uma prova de trabalho em JavaScript).
 */
function testeLoginNotaCuritibana() {
  const pote = {};
  const linhas = ['Nota Curitibana — mapeamento do login (sem credencial)'];
  try {
    const home = seguirRedirecionamentos(NOTACWB_URL_BASE + '/', pote);
    linhas.push('home: HTTP ' + home.status + ' · ' + classificarRespostaPortal(home.status, home.texto, home.url) + ' · ' + home.saltos.join(' → '));
    const campos = extrairCamposOcultos(home.texto);
    const acao = extrairAcaoFormulario(home.texto, /CheckLogin/i) || '/Home/CheckLogin';
    if (!campos.__RequestVerificationToken) { linhas.push('não achei o token antifalsificação do formulário "Acessar" (o HTML mudou?)'); }
    const corpo = Object.keys(campos).map(function (k) { return k + '=' + encodeURIComponent(campos[k]); }).join('&');
    const post = requisicaoPortal(resolverUrl(NOTACWB_URL_BASE + '/', acao), { method: 'post', payload: corpo, headers: { Referer: NOTACWB_URL_BASE + '/', Origin: NOTACWB_URL_BASE } }, pote);
    linhas.push('CheckLogin: HTTP ' + post.status + (post.local ? ' → ' + hostDeUrl(post.local) : ''));
    if (post.status >= 300 && post.status < 400 && post.local) {
      const ecid = seguirRedirecionamentos(resolverUrl(NOTACWB_URL_CHECKLOGIN, post.local).replace(/^http:/, 'https:'), pote);
      const classe = classificarRespostaPortal(ecid.status, ecid.texto, ecid.url);
      linhas.push('e-Cidadão: HTTP ' + ecid.status + ' · ' + classe + ' · ' + ecid.saltos.join(' → '));
      linhas.push(/altcha/i.test(ecid.texto) ? 'desafio ALTCHA (prova de trabalho) presente na página de login' : 'nenhum captcha/desafio detectado no HTML');
      linhas.push(/\/autenticacao\/loginsenha/i.test(ecid.texto) ? 'login por CPF + senha disponível (/autenticacao/loginsenha)' : 'formulário de CPF + senha é montado por JavaScript (não aparece no HTML)');
    }
  } catch (e) {
    linhas.push('FALHOU: ' + (/^conexao/.test(e.message) ? 'conexao_recusada' : textoSeguroParaLog(e.message)));
  }
  const texto = linhas.join('\n');
  Logger.log(texto);
  return texto;
}
