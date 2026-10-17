/**
 * telegram.gs — Bot do Telegram da família (canal gratuito para lançar por mensagem ou foto e
 * receber os avisos das rotinas).
 *
 * Como ligar (passo a passo também no README):
 *  1. No Telegram, fale com @BotFather → /newbot → escolha nome e usuário (termina em "bot").
 *  2. Copie o token e grave em Script Properties: TOKEN_TELEGRAM.
 *  3. Publique o App da Web e rode configurarTelegram() no editor: ele registra o webhook
 *     (URL do App da Web + ?telegram=1&chave=...) e guarda o usuário do bot.
 *  4. No app, cada pessoa pede "Vincular Telegram" (ação vincular_telegram), recebe um código de
 *     6 dígitos e manda "/start CODIGO" para o bot. Pronto: o chat fica ligado ao usuário.
 *
 * O que o bot faz:
 *  - texto → assistente (mesmas regras/IA da tela Assistente), inclusive "gastei 45 na padaria";
 *  - foto → baixa o arquivo (getFile), lê o cupom (leitura.gs) e responde com botões inline
 *    "Confirmar" / "Trocar categoria" / "Cancelar"; a confirmação grava o lançamento;
 *  - avisos das rotinas (rotinas.gs) chegam pelo chat quando `telegram_ativo` está ligado.
 *
 * Segurança: o webhook só aceita chamadas com a `chave` gerada em configurarTelegram(); o chat só
 * funciona depois de vinculado a um usuário ativo; nunca gravamos o token no código ou na planilha.
 */

const URL_API_TELEGRAM = 'https://api.telegram.org/bot';
const MINUTOS_CUPOM_PENDENTE = 30;

// ---------- Configuração ----------

function tokenTelegram() {
  return propriedade('TOKEN_TELEGRAM', '');
}

function telegramConfigurado() {
  return !!tokenTelegram();
}

/** Chamada genérica à Bot API. Devolve o `result` ou lança erro. */
function chamarTelegram(metodo, parametros) {
  const token = tokenTelegram();
  if (!token) throw new Error('TOKEN_TELEGRAM não configurado');
  const resposta = UrlFetchApp.fetch(URL_API_TELEGRAM + token + '/' + metodo, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(parametros || {}), muteHttpExceptions: true,
  });
  const json = JSON.parse(resposta.getContentText() || '{}');
  if (!json.ok) throw new Error('Telegram ' + metodo + ' falhou: ' + (json.description || resposta.getResponseCode()));
  return json.result;
}

/**
 * configurarTelegram(): rode uma vez no editor depois de publicar o App da Web.
 * Registra o webhook e guarda o usuário do bot (para montar o link t.me/...).
 */
function configurarTelegram() {
  if (!telegramConfigurado()) throw new Error('Defina TOKEN_TELEGRAM nas Propriedades do script antes (token do @BotFather).');
  const urlApp = urlDoAppWeb();
  if (!urlApp) throw new Error('Publique o App da Web antes (Implantar → Nova implantação) para existir uma URL.');
  let chave = propriedade('TELEGRAM_CHAVE_WEBHOOK', '');
  if (!chave) { chave = gerarToken(24); definirPropriedade('TELEGRAM_CHAVE_WEBHOOK', chave); }
  const eu = chamarTelegram('getMe', {});
  if (eu && eu.username) definirPropriedade('USUARIO_BOT_TELEGRAM', eu.username);
  chamarTelegram('setWebhook', { url: urlApp + '?telegram=1&chave=' + chave, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  salvarConfigChaves({ telegram_ativo: true });
  console.log('Webhook do Telegram configurado para @' + (eu ? eu.username : '?') + '. Peça aos membros para vincular pelo app.');
  return { bot: eu ? eu.username : '', webhook: urlApp + '?telegram=1' };
}

/** Link do bot (https://t.me/NomeDoBot) ou vazio. */
function urlBotTelegram() {
  const nome = propriedade('USUARIO_BOT_TELEGRAM', '');
  return nome ? 'https://t.me/' + nome.replace(/^@/, '') : '';
}

// ---------- Vínculo chat ↔ usuário ----------

/** vincular_telegram: gera um código de 6 dígitos para o usuário mandar "/start CODIGO" ao bot. */
function acaoVincularTelegram(p, ctx) {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const existente = lerAba('Telegram').find((r) => r.usuario_id === ctx.uid);
  if (existente) atualizarPorId('Telegram', ctx.uid, { codigo }, 'usuario_id');
  else inserirLinhas('Telegram', [{ usuario_id: ctx.uid, chat_id: '', codigo, vinculado_em: '', ativo: false }]);
  return { codigo, url_bot: urlBotTelegram(), bot_configurado: telegramConfigurado() };
}

/**
 * Interpreta "/start CODIGO" (função pura). Devolve null quando não é /start, o código de 6 dígitos
 * quando ele vem certo ou '' quando falta/está malformado (o bot então explica como pegar o código).
 */
function parsearComandoStart(texto) {
  const m = String(texto || '').trim().match(/^\/start(?:@\w+)?(?:[\s=]+(.*))?$/i);
  if (!m) return null; // não é /start
  const resto = String(m[1] || '').trim();
  return /^\d{6}$/.test(resto) ? resto : '';
}

/** Usuário vinculado a um chat_id (ou null). */
function usuarioPorChatTelegram(chatId) {
  const vinculo = lerAba('Telegram').find((r) => String(r.chat_id) === String(chatId) && r.ativo);
  if (!vinculo) return null;
  const u = buscarPorId('Usuarios', vinculo.usuario_id);
  return u && u.ativo ? u : null;
}

/** Liga o chat ao usuário dono do código. Devolve o usuário ou null. */
function vincularChatPorCodigo(chatId, codigo) {
  const vinculo = lerAba('Telegram').find((r) => String(r.codigo) === String(codigo) && r.codigo);
  if (!vinculo) return null;
  const u = buscarPorId('Usuarios', vinculo.usuario_id);
  if (!u || !u.ativo) return null;
  // Um chat só pode pertencer a uma pessoa: desliga vínculos antigos do mesmo chat.
  lerAba('Telegram').filter((r) => String(r.chat_id) === String(chatId) && r.usuario_id !== u.id).forEach((r) => atualizarPorId('Telegram', r.usuario_id, { ativo: false }, 'usuario_id'));
  atualizarPorId('Telegram', u.id, { chat_id: String(chatId), codigo: '', vinculado_em: agoraIso(), ativo: true }, 'usuario_id');
  return u;
}

// ---------- Envio ----------

/** Markdown do app (**negrito**) → Markdown do Telegram (*negrito*), escapando o que atrapalha. */
function textoParaTelegram(texto) {
  return String(texto || '').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/_\((.+?)\)_/g, '($1)').replace(/`/g, '\'');
}

/** Envia uma mensagem para um chat. Nunca lança (devolve false em falha). */
function enviarMensagemTelegram(chatId, texto, extra) {
  try {
    chamarTelegram('sendMessage', Object.assign({ chat_id: chatId, text: textoParaTelegram(texto).slice(0, 4000), parse_mode: 'Markdown' }, extra || {}));
    return true;
  } catch (e) {
    // Markdown mal formado derruba o envio; tenta sem formatação.
    try { chamarTelegram('sendMessage', Object.assign({ chat_id: chatId, text: String(texto || '').replace(/\*\*/g, '').slice(0, 4000) }, extra || {})); return true; } catch (e2) { console.warn('Telegram: ' + e2.message); return false; }
  }
}

/** enviarTelegram(usuario_id, texto): usado pelas rotinas. Devolve true se enviou. */
function enviarTelegram(usuarioId, texto) {
  if (!telegramConfigurado()) return false;
  const cfg = lerConfig();
  if (cfg.telegram_ativo === false) return false;
  const vinculo = lerAba('Telegram').find((r) => r.usuario_id === usuarioId && r.ativo && r.chat_id);
  if (!vinculo) return false;
  return enviarMensagemTelegram(vinculo.chat_id, texto);
}

// ---------- Webhook ----------

/** Entrada do webhook (?telegram=1). Sempre devolve algo serializável; nunca deixa o Telegram reenviar em loop. */
function tratarWebhookTelegram(e, parametrosUrl) {
  const chave = propriedade('TELEGRAM_CHAVE_WEBHOOK', '');
  if (!chave || String((parametrosUrl || {}).chave || '') !== chave) throw new ErroUsuario('Família não encontrada');
  let update = {};
  try { update = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (erro) { return { ignorado: 'corpo inválido' }; }
  try {
    if (update.callback_query) return tratarCallbackTelegram(update.callback_query);
    if (update.message) return tratarMensagemTelegram(update.message);
  } catch (erro) {
    console.error('Telegram: ' + erro.message);
    const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
    if (chatId) enviarMensagemTelegram(chatId, erro instanceof ErroUsuario ? erro.message : 'Algo deu errado por aqui. Tente de novo em instantes.');
    return { erro: erro.message };
  }
  return { ignorado: 'sem mensagem' };
}

/** Mensagem de texto ou foto. */
function tratarMensagemTelegram(msg) {
  const chatId = msg.chat.id;
  const texto = String(msg.text || msg.caption || '').trim();
  const start = parsearComandoStart(texto);
  if (start !== null) {
    if (!start) { enviarMensagemTelegram(chatId, 'Olá! Para ligar este chat à sua conta, abra o app Finanças da Família → Configurações → Telegram, pegue o código de 6 dígitos e mande aqui: /start 123456'); return { status: 'instrucoes' }; }
    const u = vincularChatPorCodigo(chatId, start);
    if (!u) { enviarMensagemTelegram(chatId, 'Código não encontrado ou vencido. Gere um novo no app (Configurações → Telegram).'); return { status: 'codigo_invalido' }; }
    enviarMensagemTelegram(chatId, 'Pronto, ' + u.apelido + '! Agora você pode mandar "gastei 45 na padaria no pix", perguntar "quanto gastamos com delivery este mês?" ou enviar a foto de um cupom.');
    return { status: 'vinculado', usuario_id: u.id };
  }
  const usuario = usuarioPorChatTelegram(chatId);
  if (!usuario) { enviarMensagemTelegram(chatId, 'Este chat ainda não está ligado a ninguém da família. No app, vá em Configurações → Telegram e mande /start com o código.'); return { status: 'nao_vinculado' }; }
  const ctx = contextoPara(usuario, {});
  if (/^\/(ajuda|help)/i.test(texto)) {
    enviarMensagemTelegram(chatId, 'Posso: lançar gastos ("gastei 45 na padaria"), responder sobre gastos, assinaturas, contas da semana e projetos, e ler fotos de cupom. Comandos: /resumo, /contas, /ajuda.');
    return { status: 'ajuda' };
  }
  if (msg.photo && msg.photo.length) return tratarFotoTelegram(msg, usuario, ctx);
  let pergunta = texto;
  if (/^\/resumo/i.test(texto)) pergunta = 'como fechamos ' + nomeMes(competenciaDe()) + '?';
  if (/^\/contas/i.test(texto)) pergunta = 'contas que vencem esta semana';
  if (!pergunta) { enviarMensagemTelegram(chatId, 'Manda um texto ou a foto de um cupom.'); return { status: 'vazio' }; }
  const resposta = responderAssistente(ctx, pergunta, listarHistoricoCurto(usuario.id), null, 'telegram');
  let saida = resposta.texto;
  if (resposta.barras && resposta.barras.length) saida += '\n\n' + resposta.barras.map((b) => '• ' + b.rotulo + ': ' + moeda(b.valor)).join('\n');
  enviarMensagemTelegram(chatId, saida);
  return { status: 'respondido', usuario_id: usuario.id };
}

/** Últimas mensagens do usuário (para a IA ter contexto no Telegram). */
function listarHistoricoCurto(uid) {
  return lerAba('Conversas').filter((c) => c.usuario_id === uid).sort((a, b) => (a.data < b.data ? -1 : 1)).slice(-6).map((c) => ({ papel: c.papel, texto: c.texto }));
}

/** Baixa um arquivo do Telegram pelo file_id. Devolve { base64, mime }. */
function baixarArquivoTelegram(fileId) {
  const info = chamarTelegram('getFile', { file_id: fileId });
  const resposta = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + tokenTelegram() + '/' + info.file_path, { muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) throw new Error('Não consegui baixar a foto do Telegram');
  const blob = resposta.getBlob();
  const mime = blob.getContentType() || 'image/jpeg';
  return { base64: Utilities.base64Encode(blob.getBytes()), mime: MIMES_IMAGEM.indexOf(mime) >= 0 ? mime : 'image/jpeg' };
}

/** Foto → leitura do cupom → botões de confirmação. O cupom pendente fica no cache por 30 minutos. */
function tratarFotoTelegram(msg, usuario, ctx) {
  const chatId = msg.chat.id;
  const foto = msg.photo[msg.photo.length - 1]; // a maior resolução
  const arquivo = baixarArquivoTelegram(foto.file_id);
  const blob = Utilities.newBlob(Utilities.base64Decode(arquivo.base64), arquivo.mime, nomeArquivoLeitura('cupom', arquivo.mime, 'telegram'));
  const salvo = salvarArquivoLeitura(blob, 'cupom', blob.getName());
  const leitura = lerDocumento(arquivo.base64, arquivo.mime, 'cupom', blob, ctx);
  if (!(leitura.valor > 0)) { enviarMensagemTelegram(chatId, 'Não consegui ler o valor do cupom. Tente uma foto com mais luz ou escreva: "gastei 45 na padaria".'); return { status: 'nao_lido' }; }
  const cat = leitura.categoria_id ? buscarPorId('Categorias', leitura.categoria_id) : null;
  const pendente = { valor: leitura.valor, data: leitura.data || hojeIso(), estabelecimento: leitura.estabelecimento || '', descricao: leitura.descricao || leitura.estabelecimento || '', forma_pgto: leitura.forma_pgto || 'débito', categoria_id: leitura.categoria_id || 'c_imprevistos', anexo_url: salvo.url, sugestoes: sugerirCategoria((leitura.estabelecimento || '') + ' ' + (leitura.descricao || ''), categoriasVisiveis(ctx)) };
  guardarCupomPendente(chatId, pendente);
  enviarMensagemTelegram(chatId, 'Li: *' + moeda(pendente.valor) + '* em ' + (pendente.estabelecimento || 'cupom') + ' (' + dataBr(pendente.data) + ')\nCategoria: *' + (cat ? cat.nome : pendente.categoria_id) + '*', {
    reply_markup: { inline_keyboard: [[{ text: 'Confirmar', callback_data: 'conf' }, { text: 'Trocar categoria', callback_data: 'cats' }, { text: 'Cancelar', callback_data: 'canc' }]] },
  });
  return { status: 'aguardando_confirmacao' };
}

function chaveCupomPendente(chatId) { return 'tg_cupom_' + chatId; }
function guardarCupomPendente(chatId, dados) { CacheService.getScriptCache().put(chaveCupomPendente(chatId), JSON.stringify(dados), MINUTOS_CUPOM_PENDENTE * 60); }
function lerCupomPendente(chatId) { const t = CacheService.getScriptCache().get(chaveCupomPendente(chatId)); return t ? JSON.parse(t) : null; }
function apagarCupomPendente(chatId) { CacheService.getScriptCache().remove(chaveCupomPendente(chatId)); }

/** Botões inline: confirmar, trocar categoria (cat:<id>) ou cancelar. */
function tratarCallbackTelegram(cb) {
  const chatId = cb.message.chat.id;
  const dado = String(cb.data || '');
  try { chamarTelegram('answerCallbackQuery', { callback_query_id: cb.id }); } catch (e) { /* ignora */ }
  const usuario = usuarioPorChatTelegram(chatId);
  if (!usuario) { enviarMensagemTelegram(chatId, 'Este chat não está vinculado. Use /start com o código do app.'); return { status: 'nao_vinculado' }; }
  const ctx = contextoPara(usuario, {});
  const pendente = lerCupomPendente(chatId);
  if (dado === 'canc') { apagarCupomPendente(chatId); enviarMensagemTelegram(chatId, 'Cancelado. Nada foi lançado.'); return { status: 'cancelado' }; }
  if (!pendente) { enviarMensagemTelegram(chatId, 'Esse cupom já expirou. Envie a foto de novo.'); return { status: 'expirado' }; }
  if (dado === 'cats') {
    const cats = (pendente.sugestoes || []).map((id) => buscarPorId('Categorias', id)).filter(Boolean).slice(0, 6);
    const linhas = [];
    for (let i = 0; i < cats.length; i += 2) linhas.push(cats.slice(i, i + 2).map((c) => ({ text: c.nome, callback_data: 'cat:' + c.id })));
    linhas.push([{ text: 'Cancelar', callback_data: 'canc' }]);
    enviarMensagemTelegram(chatId, 'Qual é a despesa?', { reply_markup: { inline_keyboard: linhas } });
    return { status: 'escolhendo_categoria' };
  }
  let categoriaId = pendente.categoria_id;
  let aprendeu = false;
  if (dado.indexOf('cat:') === 0) {
    const escolhida = dado.slice(4);
    if (buscarPorId('Categorias', escolhida)) { aprendeu = escolhida !== pendente.categoria_id; categoriaId = escolhida; }
  } else if (dado !== 'conf') return { ignorado: dado };
  const l = acaoSalvarLancamento({ lancamento: { valor: pendente.valor, data: pendente.data, categoria_id: categoriaId, descricao: pendente.descricao, estabelecimento: pendente.estabelecimento, forma_pgto: pendente.forma_pgto, anexo_url: pendente.anexo_url, origem: 'telegram' }, aprender_loja: aprendeu }, ctx)[0];
  apagarCupomPendente(chatId);
  const cat = buscarPorId('Categorias', l.categoria_id);
  enviarMensagemTelegram(chatId, 'Lançado: *' + moeda(l.valor) + ' · ' + (cat ? cat.nome : '') + '* em ' + dataBr(l.data) + (aprendeu ? '. Aprendi: ' + (pendente.estabelecimento || 'esta loja') + ' cai em ' + (cat ? cat.nome : '') + ' daqui em diante.' : '.'));
  gravarConversa(usuario.id, [{ id: gerarId('m'), papel: 'eu', texto: '(foto de cupom)', data: agoraIso() }, mensagemAssistente('Lancei ' + moeda(l.valor) + ' · ' + (cat ? cat.nome : ''), { lancamento: l, etiqueta: 'lançado' })]);
  return { status: 'lancado', lancamento_id: l.id };
}
