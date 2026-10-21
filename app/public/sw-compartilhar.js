/* Recebe o que outros apps compartilham com o Finanças da Família (Web Share Target).
 * O manifest aponta o compartilhamento para "./compartilhar" (POST multipart). Guardamos o arquivo
 * ou texto no Cache Storage e redirecionamos para a tela Lançar, que lê e processa. */
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'POST') return
  const url = new URL(req.url)
  if (!url.pathname.endsWith('/compartilhar')) return
  event.respondWith((async () => {
    const base = url.pathname.replace(/compartilhar$/, '')
    try {
      const form = await req.formData()
      const cache = await caches.open('compartilhados')
      const arquivo = form.getAll('arquivos').find((a) => a && typeof a === 'object' && 'size' in a && a.size > 0)
      if (arquivo) {
        await cache.put('arquivo', new Response(arquivo, { headers: { 'Content-Type': arquivo.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(arquivo.name || 'arquivo') } }))
      } else {
        await cache.delete('arquivo')
      }
      const texto = [form.get('titulo'), form.get('texto'), form.get('url')].filter((t) => typeof t === 'string' && t.trim()).join('\n')
      if (texto) await cache.put('texto', new Response(texto, { headers: { 'Content-Type': 'text/plain;charset=utf-8' } }))
      else await cache.delete('texto')
    } catch (e) { /* segue para o app mesmo assim */ }
    return Response.redirect(base + '#/lancar?compartilhado=1', 303)
  })())
})
