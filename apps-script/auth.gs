/**
 * auth.gs — Convites, PIN e tokens dos usuários.
 *
 *  - Convite: código de 6 caracteres válido por 7 dias, guardado em Script Properties
 *    (chave "convite_<CÓDIGO>"), de uso único.
 *  - PIN: nunca em texto puro. Guardamos SHA-256(sal + ":" + pin) em hexadecimal, com um sal
 *    por usuário (Utilities.computeDigest). A comparação é em tempo constante.
 *  - Token: texto aleatório por usuário; o app guarda no celular. Pode ser renovado
 *    (o antigo deixa de valer na hora).
 */

const DIAS_VALIDADE_CONVITE = 7;
/** Perfis da versão 2 ("Júnior", da v1, é aceito como sinônimo de Dependente — ver normalizarPerfil). */
const PERFIS_VALIDOS = ['Administrador', 'Adulto', 'Dependente'];
const MAX_TENTATIVAS_PIN = 5;
const MINUTOS_BLOQUEIO_PIN = 10;

// ---------- PIN ----------

/** Valida o formato do PIN: 4 a 6 dígitos. */
function validarFormatoPin(pin) {
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw new ErroUsuario('O PIN deve ter de 4 a 6 números.');
  return String(pin);
}

/** SHA-256 em hexadecimal de (sal + ":" + pin). */
function hashPin(pin, sal) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Comparação em tempo constante (não vaza em quantos caracteres acertou). */
function compararConstante(a, b) {
  const x = String(a || ''), y = String(b || '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** Gera sal + hash para um PIN novo. */
function prepararPin(pin) {
  const sal = gerarToken(16);
  return { pin_sal: sal, pin_hash: hashPin(validarFormatoPin(pin), sal) };
}

// ---------- Usuários ----------

/** Versão do usuário que pode ir para o app (sem hash/sal; token só quando permitido). */
function usuarioPublico(u, incluirToken) {
  if (!u) return null;
  const pub = {
    id: u.id, nome: u.nome, apelido: u.apelido, avatar: u.avatar, cor: u.cor, perfil: normalizarPerfil(u.perfil),
    ativo: !!u.ativo, criado_em: u.criado_em, ultimo_acesso: u.ultimo_acesso,
    mesada_mensal: Number(u.mesada_mensal) || 0,
  };
  if (incluirToken) pub.token = u.token;
  return pub;
}

/** Busca o usuário pelo token de sessão. */
function usuarioPorToken(token) {
  if (!token) return null;
  return lerAba('Usuarios').find((u) => u.token && compararConstante(u.token, token)) || null;
}

/** Garante que o usuário tem token (gera se estiver vazio). */
function garantirToken(usuario) {
  if (usuario.token) return usuario;
  return atualizarPorId('Usuarios', usuario.id, { token: gerarToken(32) });
}

// ---------- Convites ----------

function chaveConvite(codigo) { return 'convite_' + String(codigo || '').toUpperCase().trim(); }

/** Lê um convite das Script Properties (ou null). */
function lerConvite(codigo) {
  const texto = propriedade(chaveConvite(codigo), '');
  if (!texto) return null;
  try { return JSON.parse(texto); } catch (e) { return null; }
}

/**
 * perfis_familia (só token da família): lista os perfis ativos para entrar em outro aparelho
 * (URL + token + PIN, sem convite). Não devolve tokens nem dados sensíveis.
 */
function acaoPerfisFamilia() {
  const cfg = lerConfigCompleta();
  const perfis = lerAba('Usuarios').filter((u) => u.ativo).map((u) => ({
    id: u.id, apelido: u.apelido, nome: u.nome, cor: u.cor || 'indigo', avatar: u.avatar || '', perfil: normalizarPerfil(u.perfil),
  }));
  return { nome_familia: cfg.nome_familia || '', url_foto_capa: cfg.url_foto_capa || '', perfis };
}

/** Remove convites vencidos ou usados (faxina). */
function limparConvitesVencidos() {
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const agora = Date.now();
  Object.keys(todas).forEach((k) => {
    if (k.indexOf('convite_') !== 0) return;
    try {
      const c = JSON.parse(todas[k]);
      if (c.usado_por || new Date(c.expira_em).getTime() < agora) props.deleteProperty(k);
    } catch (e) { props.deleteProperty(k); }
  });
}

/**
 * gerar_convite (Administrador): cria o código e a URL que a pessoa abre no celular.
 * A URL inclui a API e o token da família para o app se configurar sozinho.
 */
function acaoGerarConvite(p, ctx) {
  const perfil = PERFIS_VALIDOS.indexOf(normalizarPerfil(p.perfil)) >= 0 ? normalizarPerfil(p.perfil) : 'Adulto';
  const convite = criarConvite(perfil, ctx.uid, p.usuario_id_convidado || '');
  const cfg = lerConfigCompleta();
  const url = montarLinkConvite(convite.codigo, perfil, urlDoAppWeb(), cfg.token_familia || '');
  return { codigo_convite: convite.codigo, url, expira_em: convite.expira_em };
}

/** Cria e grava um convite (código de 6 caracteres, validade DIAS_VALIDADE_CONVITE). usuarioId liga o convite a um usuário já existente. */
function criarConvite(perfil, criadoPor, usuarioId) {
  limparConvitesVencidos();
  const codigo = gerarCodigoConvite();
  const expira = new Date(Date.now() + DIAS_VALIDADE_CONVITE * 86400000);
  const convite = { codigo, perfil, expira_em: expira.toISOString(), criado_por: criadoPor || '', usuario_id: usuarioId || '' };
  definirPropriedade(chaveConvite(codigo), JSON.stringify(convite));
  return convite;
}

/**
 * Link que o convidado abre no celular: app publicado + um único parâmetro `c` (base64url de um JSON com
 * convite, perfil, URL da API e token da família). Sem `%`, `:` nem `&` no link, que apps de mensagem às
 * vezes cortam ou alteram. O app também aceita a forma antiga (?convite=&perfil=&api=&familia=).
 */
function montarLinkConvite(codigo, perfil, urlApi, tokenFamilia) {
  const dados = { convite: codigo, perfil: perfil, api: urlApi || '', familia: tokenFamilia || '' };
  const c = Utilities.base64EncodeWebSafe(JSON.stringify(dados), Utilities.Charset.UTF_8).replace(/=+$/, '');
  return obterUrlApp() + '#/entrar?c=' + c;
}

/**
 * URL pública deste App da Web (/exec). No editor, ScriptApp devolve a URL de teste (/dev), que exige login;
 * nesse caso usamos a URL_API memorizada pela última requisição real (ou definida nas Script Properties).
 */
function urlDoAppWeb() {
  let atual = '';
  try { atual = ScriptApp.getService().getUrl() || ''; } catch (e) { atual = ''; }
  if (/\/exec$/.test(atual)) return atual;
  const salva = propriedade('URL_API', '');
  return salva || atual;
}

/**
 * entrar_convite (sem autenticação): cria o usuário (ou ativa um pré-cadastrado), define o PIN
 * e devolve o usuário com token. O convite é de uso único.
 */
function acaoEntrarConvite(p) {
  const codigo = String(p.codigo_convite || '').toUpperCase().trim();
  const convite = lerConvite(codigo);
  if (!convite || convite.usado_por || new Date(convite.expira_em).getTime() < Date.now()) {
    throw new ErroUsuario('Convite inválido ou vencido. Peça um novo ao administrador.');
  }
  const apelido = String(p.apelido || p.nome || '').trim();
  if (!apelido) throw new ErroUsuario('Diga como quer ser chamado (apelido).');
  const pin = prepararPin(p.pin);
  const agora = agoraIso();
  let usuario;
  const existente = convite.usuario_id ? buscarPorId('Usuarios', convite.usuario_id) : null;
  if (existente) {
    usuario = atualizarPorId('Usuarios', existente.id, Object.assign({
      apelido, nome: String(p.nome || existente.nome || apelido).trim(), avatar: p.avatar || existente.avatar || '', cor: p.cor || existente.cor || 'indigo',
      ativo: true, ultimo_acesso: agora, token: gerarToken(32),
    }, pin));
  } else {
    usuario = inserirLinhas('Usuarios', [Object.assign({
      id: gerarId('u'), nome: String(p.nome || apelido).trim(), apelido, avatar: p.avatar || '', cor: p.cor || 'indigo',
      // O perfil vem do convite (definido pelo administrador); o enviado pelo app só vale se o convite não tiver.
      perfil: normalizarPerfil(convite.perfil || p.perfil || 'Adulto'), ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0,
      token: gerarToken(32), origem: 'convite',
    }, pin)])[0];
  }
  convite.usado_por = usuario.id;
  definirPropriedade(chaveConvite(codigo), JSON.stringify(convite));
  registrarLog(usuario.id, 'entrar_convite', 'Entrou com convite ' + codigo + ' como ' + convite.perfil);
  return usuarioPublico(usuario, true);
}

// ---------- Entrada por PIN ----------

function chaveFalhasPin(uid) { return 'pin_falhas_' + uid; }

/** entrar_pin (sem autenticação): confere o PIN e devolve o usuário com token. */
function acaoEntrarPin(p) {
  const usuario = buscarPorId('Usuarios', String(p.usuario_id || ''));
  if (!usuario) throw new ErroUsuario('Usuário não encontrado');
  if (!usuario.ativo) throw new ErroUsuario('Este usuário está desativado. Fale com o administrador.');
  if (!usuario.pin_hash) throw new ErroUsuario('PIN ainda não definido. Peça ao administrador para redefinir.');

  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get(chaveFalhasPin(usuario.id)) || 0);
  if (falhas >= MAX_TENTATIVAS_PIN) throw new ErroUsuario('Muitas tentativas. Aguarde ' + MINUTOS_BLOQUEIO_PIN + ' minutos e tente de novo.');

  const informado = hashPin(String(p.pin || ''), usuario.pin_sal || '');
  if (!compararConstante(informado, usuario.pin_hash)) {
    cache.put(chaveFalhasPin(usuario.id), String(falhas + 1), MINUTOS_BLOQUEIO_PIN * 60);
    throw new ErroUsuario('PIN incorreto');
  }
  cache.remove(chaveFalhasPin(usuario.id));
  const comToken = garantirToken(usuario);
  atualizarPorId('Usuarios', usuario.id, { ultimo_acesso: agoraIso() });
  return usuarioPublico(comToken, true);
}

// ---------- Token e PIN (administração) ----------

/** renovar_token: o próprio usuário ou um Administrador para qualquer um. */
function acaoRenovarToken(p, ctx) {
  const alvo = String(p.usuario_id || ctx.uid);
  if (alvo !== ctx.uid && !ctx.ehAdmin) throw new ErroUsuario('Sem permissão');
  const u = buscarPorId('Usuarios', alvo);
  if (!u) throw new ErroUsuario('Usuário não encontrado');
  const novo = atualizarPorId('Usuarios', alvo, { token: gerarToken(32) });
  return { token: novo.token };
}

/** redefinir_pin (Administrador). */
function acaoRedefinirPin(p, ctx) {
  const u = buscarPorId('Usuarios', String(p.usuario_id || ''));
  if (!u) throw new ErroUsuario('Usuário não encontrado');
  atualizarPorId('Usuarios', u.id, prepararPin(p.pin));
  try { CacheService.getScriptCache().remove(chaveFalhasPin(u.id)); } catch (e) { /* ignora */ }
  return { ok: true };
}

// ---------- Listar / salvar usuários ----------

/** listar_usuarios (Adulto): tokens só para Administrador. */
function acaoListarUsuarios(p, ctx) {
  return lerAba('Usuarios').map((u) => usuarioPublico(u, ctx.ehAdmin || u.id === ctx.uid));
}

/** salvar_usuario (Administrador): cria ou edita. Pode definir PIN inicial via `usuario.pin`. */
function acaoSalvarUsuario(p, ctx) {
  const u = p.usuario || {};
  if (u.perfil) u.perfil = normalizarPerfil(u.perfil);
  if (u.perfil && PERFIS_VALIDOS.indexOf(u.perfil) < 0) throw new ErroUsuario('Perfil inválido: ' + u.perfil);
  const agora = agoraIso();
  const campos = {
    nome: u.nome, apelido: u.apelido, avatar: u.avatar, cor: u.cor, perfil: u.perfil,
    ativo: u.ativo === undefined ? undefined : paraBooleano(u.ativo),
    mesada_mensal: u.mesada_mensal === undefined ? undefined : lerValor(u.mesada_mensal),
  };
  if (u.pin) Object.assign(campos, prepararPin(u.pin));
  let salvo;
  const existente = u.id ? buscarPorId('Usuarios', u.id) : null;
  if (existente) {
    if (existente.id === ctx.uid && campos.perfil && campos.perfil !== 'Administrador') throw new ErroUsuario('Você não pode rebaixar o seu próprio perfil.');
    salvo = atualizarPorId('Usuarios', existente.id, semUndefined(campos));
  } else {
    salvo = inserirLinhas('Usuarios', [Object.assign({
      id: u.id || gerarId('u'), nome: u.apelido || '', apelido: u.apelido || 'Novo membro', avatar: '', cor: 'indigo',
      perfil: 'Adulto', ativo: true, criado_em: agora, ultimo_acesso: agora, mesada_mensal: 0, token: gerarToken(32), origem: 'manual',
    }, semUndefined(campos))])[0];
  }
  return usuarioPublico(salvo, true);
}
