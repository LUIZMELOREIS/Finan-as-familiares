/**
 * Link de convite compacto: um único parâmetro `c` com os dados em base64url (JSON).
 * Evita `%`, `:` e `&` no link, que apps de mensagem às vezes cortam ou alteram.
 */
export interface ConviteCompacto {
  convite: string
  perfil?: string
  api?: string
  familia?: string
  demo?: string
}

function paraBase64Url(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

export function codificarConvite(dados: ConviteCompacto): string {
  return paraBase64Url(new TextEncoder().encode(JSON.stringify(dados)))
}

/** Devolve null se o texto não for um convite compacto válido. */
export function decodificarConvite(texto: string | null | undefined): ConviteCompacto | null {
  if (!texto) return null
  try {
    const obj = JSON.parse(new TextDecoder().decode(deBase64Url(texto.trim()))) as Partial<ConviteCompacto>
    if (!obj || typeof obj !== 'object' || typeof obj.convite !== 'string') return null
    if (!obj.convite && !obj.familia) return null
    return { convite: obj.convite, perfil: obj.perfil, api: obj.api, familia: obj.familia, demo: obj.demo }
  } catch { return null }
}
