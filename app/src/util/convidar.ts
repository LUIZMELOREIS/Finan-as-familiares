/**
 * Convite rápido pela família: mensagem pronta (link + 3 passos) e link do WhatsApp.
 * Funções puras, usadas pela tela Convidar e por Configurações → Membros.
 */

/** Só dígitos; números brasileiros com DDD (10–11 dígitos) ganham o 55 na frente. */
export function telefoneParaWhatsApp(telefone: string): string {
  let d = (telefone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d
}

/** Link `wa.me`: com telefone abre a conversa da pessoa; sem, o WhatsApp pede para escolher o contato. */
export function linkWhatsApp(texto: string, telefone = ''): string {
  const tel = telefoneParaWhatsApp(telefone)
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
}

/** Mensagem que a pessoa recebe. `*negrito*` é a marcação do WhatsApp. */
export function mensagemConvite(opcoes: { nome?: string; url: string; nomeFamilia?: string; validade?: string; quemConvida?: string }): string {
  // Sem emojis de propósito: o redirecionamento do wa.me troca alguns por "�".
  const ola = opcoes.nome?.trim() ? `Oi, ${opcoes.nome.trim()}!` : 'Oi!'
  const familia = opcoes.nomeFamilia?.trim() ? ` da ${opcoes.nomeFamilia.trim()}` : ' da nossa família'
  const quem = opcoes.quemConvida?.trim() ? ` (${opcoes.quemConvida.trim()})` : ''
  return [
    `${ola} Montei o app *Finanças da Família* pra gente cuidar junto das contas${familia}. Leva 1 minuto:`,
    '',
    '1) Toque no link abaixo (abre no navegador do celular)',
    '2) Escolha seu apelido, uma foto e crie um PIN de 4 números',
    '3) Toque em *Instalar* para ele ficar entre os seus aplicativos (no iPhone: botão Compartilhar > *Adicionar à Tela de Início*)',
    '',
    opcoes.url,
    '',
    `Esse link é só seu${opcoes.validade ? ` e vale até ${opcoes.validade}` : ''}. Qualquer dúvida me chama${quem}.`,
  ].join('\n')
}

/** Mensagem curta para quem já tem perfil e vai entrar num celular novo (link da família, sem convite). */
export function mensagemOutroAparelho(url: string): string {
  return ['Para abrir o *Finanças da Família* neste celular: toque no link, escolha o seu nome e digite o seu PIN. Depois toque em *Instalar*.', '', url].join('\n')
}
