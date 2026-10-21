/** Lê (e apaga) o que o service worker guardou ao receber um compartilhamento de outro app. */
export interface Compartilhado { arquivo: File | null; texto: string }

export async function lerCompartilhado(): Promise<Compartilhado> {
  const vazio: Compartilhado = { arquivo: null, texto: '' }
  if (typeof caches === 'undefined') return vazio
  try {
    const cache = await caches.open('compartilhados')
    const [ra, rt] = await Promise.all([cache.match('arquivo'), cache.match('texto')])
    let arquivo: File | null = null
    if (ra) {
      const blob = await ra.blob()
      const nome = decodeURIComponent(ra.headers.get('X-Nome') || 'arquivo')
      arquivo = new File([blob], nome, { type: ra.headers.get('Content-Type') || blob.type })
    }
    const texto = rt ? (await rt.text()).trim() : ''
    await Promise.all([cache.delete('arquivo'), cache.delete('texto')])
    return { arquivo, texto }
  } catch { return vazio }
}
