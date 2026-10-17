// Abre o app (build de produção) em tamanho de celular (390×844) e salva prints de cada tela em app/capturas/.
// Uso: npm run build && npm run capturas
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const raiz = new URL('../dist/', import.meta.url).pathname
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }
const servidor = createServer(async (req, res) => {
  let caminho = join(raiz, decodeURIComponent(req.url.split('?')[0]))
  try { if ((await stat(caminho)).isDirectory()) caminho = join(caminho, 'index.html') } catch { caminho = join(raiz, 'index.html') }
  try { res.setHeader('Content-Type', tipos[extname(caminho)] || 'application/octet-stream'); res.end(await readFile(caminho)) } catch { res.statusCode = 404; res.end() }
})
await new Promise((r) => servidor.listen(4173, r))

mkdirSync(new URL('../capturas/', import.meta.url), { recursive: true })
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' })
const pagina = await contexto.newPage()
pagina.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message))
const base = 'http://localhost:4173/'

// Entra em modo demonstração como "Pai" e pula o tutorial.
await pagina.goto(base)
await pagina.evaluate(() => {
  localStorage.setItem('ff_sessao', JSON.stringify({ url_api: '', token_familia: 'demo', token: 'tok_pai_demo', usuario_id: 'u_pai' }))
  localStorage.setItem('ff_preferencias', JSON.stringify({ tema: 'escuro', letra: 'normal', alto_contraste: false, tutorial_visto: true }))
})

const telas = process.argv[2] ? process.argv[2].split(',') : ['', 'grupo/g_diaadia', 'lancar', 'painel', 'caixa', 'sonhos', 'sonhos/p_gramado', 'conselho', 'reuniao', 'contas', 'mais', 'configuracoes', 'brasao', 'captura', 'mesada', 'tutorial', 'entrar']
for (const tela of telas) {
  if (tela === 'entrar' || tela === 'tutorial') await pagina.evaluate((t) => { if (t === 'entrar') localStorage.removeItem('ff_sessao'); else localStorage.setItem('ff_preferencias', JSON.stringify({ tema: 'escuro', letra: 'normal', alto_contraste: false, tutorial_visto: false })) }, tela)
  await pagina.goto(`${base}#/${tela}`)
  await pagina.reload()
  await pagina.waitForLoadState('networkidle')
  await pagina.waitForTimeout(900)
  const nome = (tela || 'inicio').replace(/[\/:]/g, '_')
  await pagina.screenshot({ path: new URL(`../capturas/${nome}.png`, import.meta.url).pathname, fullPage: true })
  console.log('captura:', nome)
}
await navegador.close()
servidor.close()
