import { chromium } from '@playwright/test'
const arquivo = 'file://' + new URL('../../docs/referencia/referencia_visual.html', import.meta.url).pathname
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [nome, w, h, mobile] of [['desk', 1440, 900, false], ['cel', 390, 844, true]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  await p.goto(arquivo); await p.waitForTimeout(800)
  for (const v of ['painel', 'lancar', 'assistente', 'projetos']) {
    await p.evaluate((id) => { document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === id)); window.scrollTo(0,0) }, v)
    await p.waitForTimeout(300)
    await p.screenshot({ path: new URL(`../../docs/referencia/ref_${nome}_${v}.png`, import.meta.url).pathname, fullPage: true })
  }
  await ctx.close()
}
await nav.close()
console.log('ok')
