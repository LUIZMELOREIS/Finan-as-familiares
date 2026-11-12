/**
 * notaCuritibana.gs — Leitor do Nota Curitibana (NFS-e de serviços, só em Curitiba).
 *
 * Especificação: docs/ROBO_NOTAS_FISCAIS.md. Depende dos ajudantes de rede, cookies e credenciais de
 * notasFiscais.gs.
 *
 * O que o mapeamento de 11/11/2026 mostrou: a home faz `POST /Home/CheckLogin` (token antifalsificação)
 * e redireciona para o **e-Cidadão** da Prefeitura (`autenticacao-ecidadao.curitiba.pr.gov.br`), cuja página
 * de login carrega o **ALTCHA** (prova de trabalho em JavaScript) e monta o formulário de CPF + senha por
 * script (`/autenticacao/loginsenha/`). Por isso:
 *  - `testeLoginNotaCuritibana()` (Fase 0) mapeia o caminho sem credencial e relata o desafio;
 *  - `loginNotaCuritibana()` tenta o caminho CPF + senha quando o e-Cidadão não exigir o desafio; se exigir,
 *    devolve `desafio` e a sincronização suspende a fonte e avisa o administrador (Plano B para esta fonte).
 *  - Os parsers PUROS `extrairMesesCwb(html)` e `extrairNotasCwb(html|json)` já leem a tabela por mês e o
 *    detalhe do mês (Número · Chave de Acesso (50 dígitos) · Prestador · Data · Situação · Valor · Crédito),
 *    para o leitor ficar pronto assim que o login for resolvido.
 */

// ---------- Endereços ----------

/** Nota Curitibana: o botão "Acessar" faz POST em /Home/CheckLogin e cai no e-Cidadão da Prefeitura. */
const NOTACWB_URL_BASE = 'https://notacuritibana.curitiba.pr.gov.br';
const NOTACWB_URL_CHECKLOGIN = NOTACWB_URL_BASE + '/Home/CheckLogin';
const NOTACWB_URL_NFSE = NOTACWB_URL_BASE + '/Nfse';
const ECIDADAO_HOST = 'autenticacao-ecidadao.curitiba.pr.gov.br';

// ---------- Funções puras: parsers ----------

/**
 * Tabela de meses de `/Nfse` (Mês emissão · Quant. notas · Valor total · Total créditos, lupa `data-action="detalhe"`)
 * → [{ competencia: 'aaaa-mm', quantidade, valor, credito, ref }], onde `ref` é o valor do atributo `data-*` da lupa
 * (id/mes) usado para pedir o detalhe. Aceita "10/2026", "Outubro/2026" e "2026-10".
 */
function extrairMesesCwb(html) {
  const saida = [];
  const linhas = String(html || '').match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  linhas.forEach(function (tr) {
    const cel = (tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || []).map(limparHtml);
    if (cel.length < 3) return;
    const comp = competenciaDeTextoCwb(cel[0]);
    if (!comp) return;
    const nums = cel.slice(1).map(function (c) { return /^(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?$/.test(c) ? lerValor(c) : null; }).filter(function (n) { return n !== null; });
    const lupa = tr.match(/data-action="detalhe"[^>]*/i) || tr.match(/<[^>]*data-action="detalhe"[^>]*>/i);
    const ref = lupa ? ((lupa[0].match(/data-(?:id|mes|competencia|periodo|valor)="([^"]+)"/i) || ['', ''])[1] || (tr.match(/data-(?:id|mes|competencia|periodo)="([^"]+)"/i) || ['', ''])[1]) : '';
    saida.push({ competencia: comp, quantidade: nums.length ? Math.round(nums[0]) : 0, valor: nums.length > 1 ? nums[1] : 0, credito: nums.length > 2 ? nums[2] : 0, ref: ref || comp });
  });
  return saida;
}

/** "10/2026", "Outubro/2026", "out/2026", "2026-10" → "2026-10" ('' se não for mês). */
function competenciaDeTextoCwb(texto) {
  const bruto = String(texto || '').trim();
  let m = bruto.match(/^(\d{2})\/(\d{4})$/);
  if (m) return m[2] + '-' + m[1];
  m = bruto.match(/^(\d{4})-(\d{2})$/);
  if (m) return m[1] + '-' + m[2];
  const t = normalizar(texto).trim();
  m = t.match(/^([A-Z]{3,9})[\/ -]+(\d{4})$/);
  if (m) {
    const idx = MESES_PT.map(function (n) { return normalizar(n); }).findIndex(function (n) { return n === m[1] || n.slice(0, 3) === m[1].slice(0, 3); });
    if (idx >= 0) return m[2] + '-' + zeros(idx + 1, 2);
  }
  return '';
}

/**
 * Detalhe do mês (tabela ou JSON do DataTables) → [{ id_portal (número), chave_acesso (50 dígitos), cnpj, emitente,
 * data_emissao, situacao, valor, credito }]. Não há itens numa NFS-e; para serviço, isso basta.
 */
function extrairNotasCwb(conteudo) {
  const texto = String(conteudo || '').trim();
  if (texto.charAt(0) === '{' || texto.charAt(0) === '[') {
    try { return notasCwbDeJson(JSON.parse(texto)); } catch (e) { /* cai no HTML */ }
  }
  const saida = [];
  const vistas = {};
  (texto.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
    const cel = (tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || []).map(limparHtml);
    if (cel.length < 4) return;
    const chave = (tr.replace(/<[^>]+>/g, ' ').match(/\b(\d{50})\b/) || (tr.match(/(?:\d{4}[ .-]?){12}\d{2}/) ? [tr.match(/(?:\d{4}[ .-]?){12}\d{2}/)[0].replace(/\D/g, '')] : null) || [''])[0];
    const data = tr.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/);
    if (!data && !chave) return;
    const numero = (cel.find(function (c) { return /^\d{1,12}$/.test(c); }) || '').trim();
    const id = chave || numero;
    if (!id || vistas[id]) return;
    vistas[id] = true;
    const valores = [];
    cel.forEach(function (c) { const v = c.match(/^(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})$/); if (v) valores.push(lerValor(v[1])); });
    const cnpj = (tr.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || [''])[0];
    const emitente = cel.find(function (c) { return /[A-Za-z]{3}/.test(c) && !/^R\$/.test(c) && !/^\d{2}\/\d{2}\/\d{4}/.test(c) && !/^(normal|cancelad[ao]|substitu[ií]d[ao]|v[aá]lid[ao])$/i.test(c) && c !== cnpj; }) || '';
    const situacaoTxt = cel.find(function (c) { return /^(normal|cancelad[ao]|substitu[ií]d[ao]|rejeitad[ao]|v[aá]lid[ao]|ativa)$/i.test(c); }) || '';
    saida.push({
      fonte: 'nota_curitibana', id_portal: numero || chave.slice(-12), tp_doc: 'nfse', chave_acesso: chave, cnpj: cnpjSoDigitos(cnpj), emitente: emitente,
      data_emissao: data ? data[3] + '-' + data[2] + '-' + data[1] + (data[4] ? ' ' + data[4] : '') : '',
      situacao: situacaoNota(situacaoTxt), valor: valores.length ? valores[0] : 0, credito: valores.length > 1 ? valores[1] : 0,
    });
  });
  return saida;
}

/** JSON do DataTables ({ data: [...] } ou array) → mesma saída de extrairNotasCwb. */
function notasCwbDeJson(json) {
  const lista = Array.isArray(json) ? json : (json && (json.data || json.dados || json.notas)) || [];
  const pegar = function (o, nomes) { for (let i = 0; i < nomes.length; i++) { const k = Object.keys(o).find(function (x) { return normalizar(x).replace(/[^A-Z]/g, '') === normalizar(nomes[i]).replace(/[^A-Z]/g, ''); }); if (k !== undefined) return o[k]; } return undefined; };
  return lista.map(function (o) {
    if (Array.isArray(o)) return extrairNotasCwb('<table><tr>' + o.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr></table>')[0];
    const chave = String(pegar(o, ['chaveAcesso', 'chave_acesso', 'chave', 'codigoVerificacao']) || '').replace(/\D/g, '');
    const dataTxt = String(pegar(o, ['dataEmissao', 'data_emissao', 'data']) || '');
    const d = dataTxt.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/) || dataTxt.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/);
    const iso = d ? (d[1].length === 4 ? d[1] + '-' + d[2] + '-' + d[3] : d[3] + '-' + d[2] + '-' + d[1]) + (d[4] ? ' ' + d[4] : '') : '';
    return {
      fonte: 'nota_curitibana', id_portal: String(pegar(o, ['numero', 'numeroNota', 'id']) || chave.slice(-12)), tp_doc: 'nfse', chave_acesso: chave.length === 50 ? chave : '',
      cnpj: cnpjSoDigitos(pegar(o, ['cnpj', 'cnpjPrestador'])), emitente: String(pegar(o, ['razaoSocial', 'prestador', 'emitente', 'nome']) || ''),
      data_emissao: iso, situacao: situacaoNota(String(pegar(o, ['situacao', 'status']) || '')),
      valor: lerValor(pegar(o, ['valorNota', 'valor', 'valorServico'])), credito: lerValor(pegar(o, ['valorCredito', 'credito'])),
    };
  }).filter(Boolean);
}

// ---------- Rede ----------

/**
 * Chega até a página de login do e-Cidadão a partir do Nota Curitibana. Devolve { ok, pote, pagina (resposta),
 * classe, saltos } — `classe` é 'desafio' quando a página pede ALTCHA/captcha.
 */
function chegarAoECidadao(pote) {
  const home = seguirRedirecionamentos(NOTACWB_URL_BASE + '/', pote);
  const campos = extrairCamposOcultos(home.texto);
  const acao = extrairAcaoFormulario(home.texto, /CheckLogin/i) || '/Home/CheckLogin';
  const corpo = Object.keys(campos).map(function (k) { return k + '=' + encodeURIComponent(campos[k]); }).join('&');
  const post = requisicaoPortal(resolverUrl(NOTACWB_URL_BASE + '/', acao), { method: 'post', payload: corpo, headers: { Referer: NOTACWB_URL_BASE + '/', Origin: NOTACWB_URL_BASE } }, pote);
  const saltos = home.saltos.concat([hostDeUrl(NOTACWB_URL_CHECKLOGIN) + '/Home/CheckLogin [' + post.status + ']']);
  if (!(post.status >= 300 && post.status < 400 && post.local)) return { ok: false, pote: pote, classe: classificarRespostaPortal(post.status, post.texto, NOTACWB_URL_CHECKLOGIN), saltos: saltos, temToken: !!campos.__RequestVerificationToken };
  const ecid = seguirRedirecionamentos(resolverUrl(NOTACWB_URL_CHECKLOGIN, post.local).replace(/^http:/, 'https:'), pote);
  return { ok: true, pote: pote, pagina: ecid, classe: classificarRespostaPortal(ecid.status, ecid.texto, ecid.url), saltos: saltos.concat(ecid.saltos), temToken: !!campos.__RequestVerificationToken };
}

/**
 * Login no Nota Curitibana com usuário (CPF) + senha pelo e-Cidadão. Devolve { ok, etapa, motivo, pote, saltos }.
 * Quando a página de login exige o ALTCHA (prova de trabalho em JavaScript), devolve motivo 'desafio' — o
 * robô não tenta resolver o desafio; a sincronização suspende a fonte e avisa o administrador.
 */
function loginNotaCuritibana(credencial) {
  const pote = {};
  const resultado = { ok: false, etapa: 'inicio', motivo: '', saltos: [], pote: pote };
  if (!credencial || !credencial.usuario || !credencial.senha) { resultado.motivo = 'credencial ausente'; return resultado; }
  try {
    resultado.etapa = 'entrada';
    const chegada = chegarAoECidadao(pote);
    resultado.saltos = chegada.saltos;
    if (!chegada.ok) { resultado.motivo = chegada.classe === 'ok' ? 'o Nota Curitibana não redirecionou para o e-Cidadão' : chegada.classe; return resultado; }
    if (chegada.classe === 'desafio' || chegada.classe === 'bloqueado') { resultado.motivo = chegada.classe; return resultado; }
    resultado.etapa = 'autenticacao';
    const base = chegada.pagina.url;
    const urlLogin = resolverUrl(base, '/autenticacao/loginsenha/');
    const campos = extrairCamposOcultos(chegada.pagina.texto);
    campos.cpf = String(credencial.usuario).replace(/\D/g, '');
    campos.senha = String(credencial.senha);
    const corpo = Object.keys(campos).map(function (k) { return k + '=' + encodeURIComponent(campos[k]); }).join('&');
    const post = requisicaoPortal(urlLogin, { method: 'post', payload: corpo, headers: { Referer: base, Origin: 'https://' + ECIDADAO_HOST, 'X-Requested-With': 'XMLHttpRequest' } }, pote);
    resultado.saltos.push(ECIDADAO_HOST + '/autenticacao/loginsenha [' + post.status + ']');
    const classe = classificarRespostaPortal(post.status, post.texto, urlLogin);
    if (classe === 'desafio' || classe === 'bloqueado') { resultado.motivo = classe; return resultado; }
    if (/senha inv|usu[aá]rio ou senha|credenciais inv|cpf ou senha/i.test(post.texto)) { resultado.motivo = 'senha_invalida'; return resultado; }
    let destino = post.local;
    if (!destino && /^\s*\{/.test(post.texto)) { try { const j = JSON.parse(post.texto); destino = j.url || j.redirect || j.urlRetorno || ''; if (j.sucesso === false || j.success === false) { resultado.motivo = /senha/i.test(JSON.stringify(j)) ? 'senha_invalida' : 'o e-Cidadão recusou o login'; return resultado; } } catch (e) { /* segue */ } }
    if (!destino) { resultado.motivo = 'o e-Cidadão não redirecionou após o login (' + classe + ')'; return resultado; }
    resultado.etapa = 'retorno';
    const volta = seguirRedirecionamentos(resolverUrl(urlLogin, destino), pote);
    resultado.saltos = resultado.saltos.concat(volta.saltos);
    if (hostDeUrl(volta.url) !== hostDeUrl(NOTACWB_URL_BASE)) { resultado.motivo = 'terminou fora do Nota Curitibana'; return resultado; }
    if (!contarCookies(pote, hostDeUrl(NOTACWB_URL_BASE))) { resultado.motivo = 'sem cookie de sessão'; return resultado; }
    resultado.ok = true;
    resultado.motivo = 'ok';
    return resultado;
  } catch (e) {
    resultado.motivo = /^conexao/.test(e.message) ? 'conexao_recusada' : 'erro: ' + textoSeguroParaLog(e.message);
    return resultado;
  }
}

/** Com a sessão aberta, lê os últimos `quantosMeses` meses de NFS-e. Devolve { ok, notas, meses_lidos }. */
function lerMesesNotaCuritibana(pote, quantosMeses) {
  const lista = requisicaoPortal(NOTACWB_URL_NFSE, { headers: { Referer: NOTACWB_URL_BASE + '/' } }, pote);
  if (classificarRespostaPortal(lista.status, lista.texto, NOTACWB_URL_NFSE) !== 'ok') return { ok: false, notas: [], meses_lidos: 0 };
  const meses = extrairMesesCwb(lista.texto).sort(function (a, b) { return a.competencia < b.competencia ? 1 : -1; }).slice(0, quantosMeses || 2);
  const notas = [];
  let lidos = 0;
  meses.forEach(function (m, i) {
    if (i > 0) pausaEntreRequisicoes();
    const url = NOTACWB_URL_NFSE + '/Detalhe?mes=' + encodeURIComponent(m.ref);
    const r = requisicaoPortal(url, { headers: { Referer: NOTACWB_URL_NFSE, 'X-Requested-With': 'XMLHttpRequest' } }, pote);
    if (classificarRespostaPortal(r.status, r.texto, url) !== 'ok') return;
    lidos++;
    extrairNotasCwb(r.texto).forEach(function (n) { notas.push(n); });
  });
  return { ok: true, notas: notas, meses_lidos: lidos };
}

/** Leitor completo usado pela sincronização: login + últimos 2 meses. Mesmo formato de lerNotaParana. */
function lerNotaCuritibana(credencial, quantosMeses) {
  const login = loginNotaCuritibana(credencial);
  if (!login.ok) return { ok: false, motivo: login.motivo, etapa: login.etapa, notas: [], meses_lidos: 0 };
  const r = lerMesesNotaCuritibana(login.pote, quantosMeses || 2);
  return { ok: r.ok, motivo: r.ok ? 'ok' : 'não consegui ler a lista de meses', pote: login.pote, notas: r.notas, meses_lidos: r.meses_lidos };
}

// ---------- Fase 0: mapeamento ----------

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
    const chegada = chegarAoECidadao(pote);
    if (!chegada.temToken) linhas.push('não achei o token antifalsificação do formulário "Acessar" (o HTML mudou?)');
    const checklogin = chegada.saltos.find(function (s) { return /CheckLogin/.test(s); }) || '';
    linhas.push('CheckLogin: HTTP ' + (checklogin.match(/\[(\d+)\]/) || ['', '?'])[1] + (chegada.ok ? ' → ' + hostDeUrl(chegada.pagina.url) : ''));
    if (chegada.ok) {
      const ecid = chegada.pagina;
      linhas.push('e-Cidadão: HTTP ' + ecid.status + ' · ' + chegada.classe + ' · ' + chegada.saltos.join(' → '));
      linhas.push(/altcha/i.test(ecid.texto) ? 'desafio ALTCHA (prova de trabalho) presente na página de login' : 'nenhum captcha/desafio detectado no HTML');
      linhas.push(/\/autenticacao\/loginsenha/i.test(ecid.texto) ? 'login por CPF + senha disponível (/autenticacao/loginsenha)' : 'formulário de CPF + senha é montado por JavaScript (não aparece no HTML)');
    } else {
      linhas.push('o Nota Curitibana não redirecionou para o e-Cidadão (' + chegada.classe + ') · ' + chegada.saltos.join(' → '));
    }
  } catch (e) {
    linhas.push('FALHOU: ' + (/^conexao/.test(e.message) ? 'conexao_recusada' : textoSeguroParaLog(e.message)));
  }
  const texto = linhas.join('\n');
  Logger.log(texto);
  return texto;
}
