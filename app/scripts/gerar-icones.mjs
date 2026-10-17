// Gera os ícones PNG do manifest (192/512/maskable) a partir de public/brasao.svg usando o Chromium do Playwright.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const svg = readFileSync(new URL('../public/brasao.svg', import.meta.url), 'utf8')
mkdirSync(new URL('../public/icones/', import.meta.url), { recursive: true })
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const pagina = await navegador.newPage()
for (const [nome, tamanho, margem] of [['icone-192', 192, 0], ['icone-512', 512, 0], ['icone-512-maskable', 512, 0.1]]) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho })
  const pad = Math.round(tamanho * margem)
  await pagina.setContent(`<html><body style="margin:0;background:#0D0E23"><div style="padding:${pad}px;width:${tamanho - 2 * pad}px;height:${tamanho - 2 * pad}px">${svg.replace(/width="512" height="512"/, `width="${tamanho - 2 * pad}" height="${tamanho - 2 * pad}"`)}</div></body></html>`)
  const png = await pagina.screenshot({ type: 'png', clip: { x: 0, y: 0, width: tamanho, height: tamanho } })
  writeFileSync(new URL(`../public/icones/${nome}.png`, import.meta.url), png)
  console.log('gerado', nome)
}
await navegador.close()
