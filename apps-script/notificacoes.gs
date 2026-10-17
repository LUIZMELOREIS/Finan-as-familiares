/**
 * notificacoes.gs — Push, lembrete diário e e-mail de resumo.
 *
 * IMPORTANTE sobre Web Push: o padrão exige assinar cada envio com VAPID (ES256). O Apps Script
 * NÃO tem assinatura ECDSA (Utilities só assina HMAC/RSA), então o envio nativo não é possível aqui.
 * Solução adotada:
 *  - registrar_push guarda a assinatura (PushSubscription) na aba Push;
 *  - o envio é delegado a um serviço simples configurável na Script Property `URL_SERVICO_PUSH`
 *    (recebe POST JSON { chave, titulo, corpo, url, assinaturas: [...] } e devolve
 *    { ok, invalidas: [endpoints que expiraram] }). Pode ser uma Cloud Function/Vercel com a
 *    biblioteca web-push; `TOKEN_SERVICO_PUSH` é um segredo compartilhado opcional.
 *  - sem esse serviço, caímos para e-mail (lembrete diário e avisos de vencimento vão para os
 *    administradores). A geração das chaves VAPID (`gerarChavesVapid`) fica no serviço, fora daqui.
 */

const TEXTO_LEMBRETE = 'Você lançou os gastos de hoje?';

/** Há serviço de push configurado? */
function pushConfigurado() {
  return !!propriedade('URL_SERVICO_PUSH', '');
}

/** registrar_push: guarda/atualiza a assinatura do navegador do usuário. */
function acaoRegistrarPush(p, ctx) {
  const assinatura = typeof p.assinatura === 'string' ? JSON.parse(p.assinatura) : p.assinatura;
  if (!assinatura || !assinatura.endpoint) throw new ErroUsuario('Assinatura de notificação inválida.');
  const texto = JSON.stringify(assinatura);
  const outras = lerAba('Push').filter((r) => {
    try { return JSON.parse(r.assinatura).endpoint !== assinatura.endpoint; } catch (e) { return false; }
  });
  outras.push({ usuario_id: ctx.uid, assinatura: texto, criado_em: agoraIso() });
  substituirAba('Push', outras);
  return { ok: true, push_ativo: pushConfigurado() };
}

/**
 * Envia um push para os usuários informados. Devolve true se o serviço aceitou.
 * Se não houver serviço configurado, devolve false (quem chama decide se manda e-mail).
 */
function enviarPush(usuarioIds, titulo, corpo, url) {
  if (!pushConfigurado()) return false;
  const registros = lerAba('Push').filter((r) => !usuarioIds || usuarioIds.indexOf(r.usuario_id) >= 0);
  if (!registros.length) return false;
  const assinaturas = registros.map((r) => { try { return JSON.parse(r.assinatura); } catch (e) { return null; } }).filter(Boolean);
  const resposta = UrlFetchApp.fetch(propriedade('URL_SERVICO_PUSH'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chave: propriedade('TOKEN_SERVICO_PUSH', ''), titulo, corpo, url: url || '', assinaturas }),
  });
  if (resposta.getResponseCode() !== 200) { console.warn('Serviço de push respondeu ' + resposta.getResponseCode()); return false; }
  try {
    const r = JSON.parse(resposta.getContentText());
    if (r.invalidas && r.invalidas.length) removerAssinaturasInvalidas(r.invalidas);
  } catch (e) { /* resposta sem JSON: tudo bem */ }
  return true;
}

/** Tira da aba Push as assinaturas que o navegador cancelou. */
function removerAssinaturasInvalidas(endpoints) {
  const restantes = lerAba('Push').filter((r) => {
    try { return endpoints.indexOf(JSON.parse(r.assinatura).endpoint) < 0; } catch (e) { return false; }
  });
  substituirAba('Push', restantes);
}

/** Push para todos os usuários ativos de certos perfis. */
function enviarPushParaPerfis(perfis, titulo, corpo, url) {
  const ids = lerAba('Usuarios').filter((u) => u.ativo && perfis.indexOf(u.perfil) >= 0).map((u) => u.id);
  return enviarPush(ids, titulo, corpo, url);
}

/** Aviso "Você gastou R$ X em Y — de que é isso?" para o dono do cartão. */
function notificarNovaCompra(item) {
  if (!item.usuario_id) return false;
  return enviarPush([item.usuario_id], 'Nova compra no cartão', 'Você gastou ' + moeda(item.valor) + ' em ' + item.estabelecimento + ' — de que é isso?', '#/caixa');
}

/** lembreteDiario (gatilho diário na hora configurada): push a todos; sem push, e-mail aos administradores. */
function lembreteDiario() {
  const cfg = lerConfig();
  const enviado = enviarPushParaPerfis(['Administrador', 'Adulto', 'Júnior'], cfg.nome_familia || 'Finanças da Família', TEXTO_LEMBRETE, '#/lancar');
  if (!enviado) {
    enviarEmailAdministradores(TEXTO_LEMBRETE, '<p>' + TEXTO_LEMBRETE + '</p><p>Abra o app e registre os gastos do dia. ' +
      (propriedade('URL_APP', '') ? '<a href="' + propriedade('URL_APP') + '">Abrir o app</a>' : '') + '</p>' +
      '<p><small>Para receber este lembrete como notificação no celular, configure o serviço de push (URL_SERVICO_PUSH). Veja o README.</small></p>');
  }
  return enviado;
}

/** Endereços dos administradores: Script Property EMAILS_ADMIN (separados por vírgula) ou o dono do script. */
function emailsAdministradores() {
  const lista = propriedade('EMAILS_ADMIN', '').split(',').map((s) => s.trim()).filter(Boolean);
  if (lista.length) return lista;
  try { return [Session.getEffectiveUser().getEmail()].filter(Boolean); } catch (e) { return []; }
}

/** Envia um e-mail HTML de resumo aos administradores (nunca derruba quem chamou). */
function enviarEmailAdministradores(assunto, html) {
  const destinos = emailsAdministradores();
  if (!destinos.length) { console.warn('Sem e-mail de administrador para enviar: ' + assunto); return false; }
  const cfg = lerConfig();
  try {
    MailApp.sendEmail({
      to: destinos.join(','),
      subject: '[' + (cfg.nome_familia || 'Finanças da Família') + '] ' + assunto,
      htmlBody: '<div style="font-family:sans-serif;font-size:16px;line-height:1.5">' + html + '<hr><p><small>Enviado automaticamente pelo app Finanças da Família.</small></p></div>',
      name: cfg.nome_familia || 'Finanças da Família',
    });
    return true;
  } catch (e) {
    console.error('Falha ao enviar e-mail: ' + e.message);
    return false;
  }
}
