// Teste funcional de ponta a ponta do modo demonstração, no navegador headless,
// em celular (390×844) e computador (1440×900).
// Uso: npm run build && npm run e2e   (ou TAMANHO=desktop|movel para só um; PASSOS=3,6 para alguns)
// Falhas não interrompem o roteiro: cada passo registra o erro e tira um print em e2e-saida/.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

// ---------- servidor estático do build ----------
const raiz = new URL('../dist/', import.meta.url).pathname
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }
const servidor = createServer(async (req, res) => {
  let caminho = join(raiz, decodeURIComponent(req.url.split('?')[0]))
  try { if ((await stat(caminho)).isDirectory()) caminho = join(caminho, 'index.html') } catch { caminho = join(raiz, 'index.html') }
  try { res.setHeader('Content-Type', tipos[extname(caminho)] || 'application/octet-stream'); res.end(await readFile(caminho)) } catch { res.statusCode = 404; res.end() }
})
const PORTA = Number(process.env.PORTA || 4173)
await new Promise((r) => servidor.listen(PORTA, r))
const base = `http://localhost:${PORTA}/`

const saida = process.env.E2E_SAIDA || new URL('../e2e-saida/', import.meta.url).pathname
mkdirSync(saida, { recursive: true })

// ---------- utilidades ----------
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const hoje = new Date()
const anoAtual = hoje.getFullYear()
const mesAtual = hoje.getMonth() + 1
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const afirmar = (cond, msg) => { if (!cond) throw new Error(msg) }
/** Espera `cond()` devolver algo verdadeiro (ou lança com a mensagem). */
async function ate(cond, msg, timeout = 10000) {
  const ini = Date.now()
  let ultimo
  while (Date.now() - ini < timeout) {
    try { ultimo = await cond(); if (ultimo) return ultimo } catch (e) { ultimo = e }
    await dormir(120)
  }
  throw new Error(`Tempo esgotado (${msg})${ultimo instanceof Error ? ` — ${ultimo.message}` : ''}`)
}
/** "R$ 1.234,56" ou "R$ 1.234" → número. */
function numeroDe(texto) {
  const m = String(texto).replace(/ /g, ' ').replace(/−/g, '-').match(/-?\s?R\$\s?([\d.]+)(,\d{1,2})?/)
  if (!m) return NaN
  return Number(m[1].replace(/\./g, '') + (m[2] ? m[2].replace(',', '.') : '')) * (m[0].startsWith('-') ? -1 : 1)
}
const semNbsp = (s) => String(s ?? '').replace(/ /g, ' ')
const visivel = (loc) => loc.filter({ visible: true }).first()
const RUIDO_CONSOLE = /Failed to load resource|net::ERR_|fonts\.googleapis|fonts\.gstatic|React DevTools|Warning:|act\(|sw\.js|workbox|Service worker|ServiceWorker|Manifest/i

// PNG gerado pelo canvas do próprio navegador (cupom/fatura de mentira).
async function pngDeTeste(page, linhas) {
  const b64 = await page.evaluate((ls) => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 420
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 420); x.fillStyle = '#111'; x.font = '18px sans-serif'
    ls.forEach((l, i) => x.fillText(l, 16, 48 + i * 36))
    return c.toDataURL('image/png').split(',')[1]
  }, linhas)
  return Buffer.from(b64, 'base64')
}

// ---------- roteiro ----------
async function rodar(movel) {
  const rotulo = movel ? 'celular' : 'desktop'
  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
  const contexto = await navegador.newContext(movel
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR' })
  const page = await contexto.newPage()
  page.setDefaultTimeout(10000)
  page.on('dialog', (d) => d.accept())

  const falhas = []
  const errosPagina = []
  let passoAtual = 'início'
  page.on('pageerror', (e) => errosPagina.push({ passo: passoAtual, texto: `pageerror: ${e.message}` }))
  page.on('console', (m) => { if (m.type() === 'error' && !RUIDO_CONSOLE.test(m.text())) errosPagina.push({ passo: passoAtual, texto: `console: ${m.text().slice(0, 300)}` }) })

  const filtro = process.env.PASSOS ? process.env.PASSOS.split(',').map(Number) : null
  let contadorPrint = 0
  async function passo(numero, nome, fn) {
    if (filtro && !filtro.includes(numero)) return
    passoAtual = `${numero}. ${nome}`
    const antes = errosPagina.length
    const ini = Date.now()
    try {
      await fn()
      const novos = errosPagina.slice(antes)
      if (novos.length) throw new Error(`erros de página durante o passo: ${novos.map((e) => e.texto).join(' | ')}`)
      console.log(`  ✔ [${rotulo}] ${passoAtual} (${((Date.now() - ini) / 1000).toFixed(1)}s)`)
    } catch (e) {
      const arquivo = join(saida, `${rotulo}_${numero}_${++contadorPrint}.png`)
      try { await page.screenshot({ path: arquivo, fullPage: true }) } catch { /* sem print */ }
      falhas.push({ passo: passoAtual, erro: e.message.split('\n').filter((l) => l.trim()).slice(0, 12).join('\n      '), print: arquivo })
      console.log(`  ✘ [${rotulo}] ${passoAtual}: ${e.message.split('\n')[0]}`)
      // volta a um estado conhecido (sessão do Luiz, com internet) para o próximo passo não herdar a falha
      try { await contexto.setOffline(false); await entrarComo('u_luiz', 'tok_pai_demo') } catch { /* segue */ }
    }
  }

  // --- atalhos ---
  const ir = async (rota) => {
    const alvo = `${base}#/${rota}`
    // mesma URL não remonta a tela: passa pelo Painel antes
    if (page.url() === alvo) { await page.goto(`${base}#/`); await dormir(200) }
    await page.goto(alvo)
    await dormir(150)
  }
  const campo = async (sel) => semNbsp(await page.locator(sel).inputValue())
  const prefs = { tema: 'escuro', letra: 'normal', alto_contraste: false, tutorial_visto: true }
  async function entrarComo(usuario_id, token) {
    await page.evaluate(([u, t, p]) => {
      localStorage.setItem('ff_sessao', JSON.stringify({ url_api: '', token_familia: 'demo', token: t, usuario_id: u }))
      localStorage.setItem('ff_preferencias', JSON.stringify(p))
    }, [usuario_id, token, prefs])
    await page.goto(`${base}#/`)
    await page.reload()
    await esperarPainel()
  }
  const cards = () => page.locator('.groups .gcard')
  async function esperarPainel(n) {
    await ate(async () => (await cards().count()) >= (n ?? 3), 'cards do Painel')
    await ate(async () => (await page.locator('.topbar h2').textContent())?.startsWith('Painel de'), 'título do Painel')
  }
  async function valoresCards() {
    return Object.fromEntries(await page.locator('.groups .gcard').evaluateAll((els) => els.map((e) => [e.querySelector('.name')?.textContent?.trim(), e.querySelector('.val')?.textContent?.trim()])))
  }
  async function painelCarregado() {
    // espera o painel terminar de carregar (próximas saídas e avisos saem de "Carregando…")
    await ate(async () => (await page.locator('.dash .rows:has-text("Carregando…")').count()) === 0, 'painel carregado')
  }
  const toast = (texto) => ate(async () => (await page.locator('.aviso-toast').evaluateAll((els, t) => els.some((e) => e.textContent.replace(/ /g, ' ').includes(t)), texto)), `aviso "${texto}"`)
  const fecharToasts = () => page.locator('.aviso-toast button[aria-label="Fechar aviso"]').evaluateAll((bs) => bs.forEach((b) => b.click()))
  const folha = () => page.locator('.folha[role="dialog"]')
  async function semFolha() { await ate(async () => (await folha().count()) === 0, 'folha fechada') }
  async function escolherMes(mes) {
    if (movel) await page.locator(`.mhead .mscroll button[role="tab"]:has-text("${MESES[mes - 1]}")`).click()
    else await page.locator(`.side .months button:has-text("${MESES[mes - 1]}")`).click()
  }
  async function escolherAno(ano) {
    if (movel) await page.locator('.mhead select[aria-label="Ano"]').selectOption(String(ano))
    else await page.locator(`.side .years button:has-text("${ano}")`).click()
  }
  async function digitarPin(seletorBase, pin) {
    for (const d of pin) await page.locator(`${seletorBase} .teclado button.num:text-is("${d}")`).click()
  }
  /** Lança pelo método Digitar: valor em centavos (string de dígitos), chip e opções. */
  async function lancarDigitando({ centavos, chip, credito, cartao, parcelas }) {
    await ir('lancar')
    await page.locator('.method:has-text("Digitar")').click()
    await page.locator('#valor').fill(centavos)
    if (credito) {
      await page.locator('.seg button:has-text("Crédito")').click()
      if (cartao) await page.locator('#cartao').selectOption(cartao)
      if (parcelas) await page.locator('#parcelas').selectOption(String(parcelas))
    }
    await page.locator(`.chips .chip:has-text("${chip}")`).first().click()
    await ate(async () => (await page.locator('.chip[aria-pressed="true"]').count()) > 0, 'chip marcado')
    await fecharToasts()
    await page.locator('button:has-text("Confirmar lançamento")').click()
    const valor = (Number(centavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    await toast(`Lançado: R$ ${valor}`)
    await ate(async () => (await page.locator('.card:has-text("Lançado") .tag:has-text("confirmado")').count()) > 0, 'card Lançado')
  }

  await page.goto(base)
  await page.evaluate(() => { localStorage.clear() })
  await page.reload()

  // 1 ---------------------------------------------------------------
  await passo(1, 'Capa → dados de exemplo → Luiz → Tutorial → Painel', async () => {
    await page.locator('button:has-text("Experimentar com dados de exemplo")').click()
    await page.locator('.rows button.row:has-text("Luiz")').click()
    // Tutorial: 4 telas
    await ate(async () => (await page.locator('button:has-text("Próximo")').count()) > 0, 'tutorial')
    for (let i = 0; i < 3; i++) {
      afirmar((await page.locator('[aria-label^="Tela "]').getAttribute('aria-label')) === `Tela ${i + 1} de 4`, `tela ${i + 1} do tutorial`)
      await page.locator('button:has-text("Próximo")').click()
    }
    await page.locator('button:has-text("Começar")').click()
    await esperarPainel(4)
    const p = JSON.parse(await page.evaluate(() => localStorage.getItem('ff_preferencias') || '{}'))
    afirmar(p.tutorial_visto === true, 'tutorial_visto gravado')
    afirmar((await cards().count()) === 4, '4 cards')
    const v = await valoresCards()
    for (const [nome, val] of Object.entries(v)) afirmar(/^R\$\s?[\d.]+/.test(val || ''), `card ${nome} em R$ (${val})`)
    await painelCarregado()
  })

  // 2 ---------------------------------------------------------------
  await passo(2, 'Painel: filtros, donut, detalhamento, edição, avisos, saídas, visão', async () => {
    await ir('')
    await esperarPainel(4)
    await painelCarregado()
    const antes = JSON.stringify(await valoresCards())
    const outroMes = mesAtual === 1 ? 12 : mesAtual - 1
    await escolherMes(outroMes)
    await ate(async () => (await page.locator('.topbar h2').textContent()) === `Painel de ${MESES[outroMes - 1].toLowerCase()}`, 'título muda com o mês')
    await ate(async () => JSON.stringify(await valoresCards()) !== antes, 'valores mudam com o mês')
    await escolherAno(anoAtual - 1)
    await ate(async () => (await page.locator('.topbar h2').textContent())?.endsWith(`de ${anoAtual - 1}`), 'título mostra o ano')
    await escolherAno(anoAtual)
    await escolherMes(mesAtual)
    await ate(async () => JSON.stringify(await valoresCards()) === antes, 'valores voltam ao mês atual')
    await painelCarregado()

    // fatia do donut (evento de clique direto no arco) e legenda
    const fatia = page.locator('article:has(h3:has-text("Despesas no mês")) svg circle[style*="cursor"]').first()
    afirmar((await fatia.count()) > 0, 'donut do mês tem fatias')
    await fatia.dispatchEvent('click')
    await ate(async () => (await folha().count()) > 0, 'folha da fatia')
    await ate(async () => (await folha().locator('.rows button.row').count()) > 0, 'lançamentos da fatia')
    await folha().locator('button[aria-label="Fechar"]').click()
    await semFolha()
    await page.locator('article:has(h3:has-text("Despesas no mês")) .donut-legend button').first().click()
    await ate(async () => (await folha().count()) > 0, 'folha pela legenda')
    await folha().locator('button[aria-label="Fechar"]').click()
    await semFolha()

    // categoria do detalhamento → lançamento → editar
    const barra = page.locator('.detail .hbars button.track').first()
    afirmar((await barra.count()) > 0, 'detalhamento tem barras')
    await barra.click()
    await ate(async () => (await folha().locator('.rows button.row').count()) > 0, 'lançamentos da categoria')
    const primeiro = folha().locator('.rows button.row').first()
    const valorLinha = numeroDe(await primeiro.locator('.amt').textContent())
    await primeiro.click()
    await ate(async () => (await page.locator('.folha[aria-label="Lançamento"]').count()) > 0, 'detalhe do lançamento')
    await page.locator('.folha button:has-text("Editar")').click()
    await ate(() => page.url().includes('#/lancar?editar='), 'rota de edição')
    await ate(async () => (await page.locator('h2:has-text("Editar lançamento")').count()) > 0, 'tela de edição')
    const valorCampo = numeroDe(await campo('#valor'))
    afirmar(Math.abs(valorCampo - valorLinha) < 0.01, `valor preenchido (${valorCampo} ≠ ${valorLinha})`)
    afirmar((await page.locator('.chip[aria-pressed="true"]').count()) > 0, 'categoria marcada na edição')
    afirmar(!!(await page.locator('#data').inputValue()), 'data preenchida')
    await page.locator('button[aria-label="Voltar"]').click()
    await esperarPainel(4)
    await painelCarregado()

    // próximas saídas e avisos
    afirmar((await page.locator('article:has(h3:has-text("Próximas saídas")) .row').count()) > 0, 'próximas saídas renderizam')
    const acao = page.locator('article:has(h3:has-text("Avisos do assistente")) button.tag').first()
    afirmar((await acao.count()) > 0, 'há aviso com botão de ação')
    await acao.click()
    await ate(() => !/#\/$/.test(page.url()), 'botão do aviso navega')
    await ir('')
    await esperarPainel(4)
    await painelCarregado()

    // visão por membro (só a lateral do computador tem o seletor)
    if (!movel) {
      const todos = JSON.stringify(await valoresCards())
      await page.locator('.side select.member').selectOption('u_nina')
      await ate(async () => JSON.stringify(await valoresCards()) !== todos, 'totais mudam com a visão por membro')
      await page.locator('.side select.member').selectOption('')
      await ate(async () => JSON.stringify(await valoresCards()) === todos, 'totais voltam para toda a família')
    }
  })

  // 3 ---------------------------------------------------------------
  await passo(3, 'Lançar (Digitar): 45,90 Padaria, parcelado 3x, editar e apagar com Desfazer', async () => {
    await ir('')
    await esperarPainel(4)
    await painelCarregado()
    const variaveisAntes = numeroDe((await valoresCards())['Despesas variáveis'])
    await lancarDigitando({ centavos: '4590', chip: 'Padaria' })
    afirmar((await page.locator('.aviso-toast button:has-text("Desfazer")').count()) > 0, 'toast com Desfazer')
    afirmar((await page.locator('.card:has-text("Lançado") .tag:has-text("confirmado")').count()) > 0, 'card Lançado')
    await page.locator('a:has-text("Voltar ao Painel")').click()
    await esperarPainel(4)
    await ate(async () => {
      const v = numeroDe((await valoresCards())['Despesas variáveis'])
      return Math.abs(v - variaveisAntes - 45.9) <= 1.01
    }, `Despesas variáveis sobe ~45,90 (antes ${variaveisAntes})`)

    // crédito + cartão + 3 parcelas
    await lancarDigitando({ centavos: '30000', chip: 'Supermercado', credito: true, cartao: 'k_itau_luiz', parcelas: 3 })
    afirmar((await page.locator('.card:has-text("Lançado"):has-text("3 parcelas")').count()) > 0, 'card com 3 parcelas')
    await ir('tipo/t_variaveis?categoria=c_mercado')
    const parcela = page.locator('#cat-c_mercado .row:has-text("1/3"):has-text("R$ 100,00")')
    try { await ate(async () => (await parcela.count()) > 0, 'parcela 1/3 em Supermercado', 6000) } catch (e) {
      // compra depois do fechamento do cartão cai na competência seguinte
      if (hoje.getDate() > 28) { await escolherMes(mesAtual === 12 ? 1 : mesAtual + 1); await ate(async () => (await parcela.count()) > 0, 'parcela 1/3 no mês seguinte'); await escolherMes(mesAtual) } else throw e
    }

    // editar o 45,90 → 51,37
    await ir('tipo/t_variaveis?categoria=c_padaria')
    await page.locator('#cat-c_padaria .row:has-text("R$ 45,90")').first().click()
    await page.locator('.folha button:has-text("Editar")').click()
    await ate(async () => (await page.locator('h2:has-text("Editar lançamento")').count()) > 0, 'edição')
    afirmar(numeroDe(await campo('#valor')) === 45.9, 'valor 45,90 preenchido na edição')
    await page.locator('#valor').fill('5137')
    await page.locator('button:has-text("Salvar alterações")').click()
    await toast('Alterações salvas')
    await ate(async () => (await page.locator('#cat-c_padaria .row:has-text("R$ 51,37")').count()) > 0, 'valor editado aparece na lista')

    // apagar com Desfazer
    await fecharToasts()
    await page.locator('#cat-c_padaria .row:has-text("R$ 51,37")').first().click()
    await page.locator('.folha button:has-text("Apagar")').click()
    await toast('Lançamento apagado')
    await ate(async () => (await page.locator('#cat-c_padaria .row:has-text("R$ 51,37")').count()) === 0, 'lançamento some')
    await page.locator('.aviso-toast:has-text("Lançamento apagado") button:has-text("Desfazer")').click()
    await ate(async () => (await page.locator('#cat-c_padaria .row:has-text("R$ 51,37")').count()) > 0, 'lançamento restaurado')
  })

  // 4 ---------------------------------------------------------------
  await passo(4, 'Lançar (Falar): texto → 120 / Combustível / débito', async () => {
    await ir('lancar')
    await page.locator('.method:has-text("Falar")').click()
    await page.locator('#voz-texto').fill('gastei 120 no posto no débito')
    await page.locator('#voz-texto').press('Enter')
    await ate(async () => (await campo('#valor')) === 'R$ 120,00', 'valor 120')
    await ate(async () => (await page.locator('.seg button[aria-pressed="true"]').textContent()) === 'Débito', 'forma débito')
    await ate(async () => (await page.locator('.chip[aria-pressed="true"]:has-text("Combustível")').count()) > 0, 'categoria Combustível')
    afirmar(/conferir/.test(await page.locator('.entry .card h3').first().textContent()), 'etiqueta conferir')
  })

  // 5 ---------------------------------------------------------------
  await passo(5, 'Lançar (Fotografar / Enviar fatura) com PNG gerado', async () => {
    await ir('lancar')
    await page.locator('.method:has-text("Fotografar cupom")').click()
    const cupom = await pngDeTeste(page, ['SUPERMERCADO CONDOR', 'CRISTO REI', 'TOTAL R$ 187,40'])
    await page.locator('input[aria-label="Fotografar cupom"]').setInputFiles({ name: 'cupom.png', mimeType: 'image/png', buffer: cupom })
    await ate(async () => (await campo('#valor')) === 'R$ 187,40', 'valor lido do cupom')
    await ate(async () => (await page.locator('.chip[aria-pressed="true"]:has-text("Supermercado")').count()) > 0, 'Supermercado sugerido')
    afirmar(/Condor/.test(await campo('#estab')), 'estabelecimento lido')
    afirmar((await page.locator('img[alt="Prévia do cupom"]').count()) === 1, 'prévia da foto')
    afirmar((await page.locator('.seg button[aria-pressed="true"]:has-text("Crédito")').count()) === 1, 'forma lida do cupom (crédito)')
    afirmar((await page.locator('#parcelas').inputValue()) === '1', 'parcelas começam em 1x')

    await page.locator('.method:has-text("Enviar fatura")').click()
    const fatura = await pngDeTeste(page, ['COPEL DISTRIBUICAO', 'VENCIMENTO 20', 'TOTAL R$ 412,37'])
    await page.locator('input[aria-label="Enviar fatura"]').setInputFiles({ name: 'fatura.png', mimeType: 'image/png', buffer: fatura })
    await ate(async () => (await campo('#ft-valor')) === '412,37', 'valor da fatura')
    afirmar((await campo('#ft-cf')) === 'f_luz', 'conta fixa Luz casada')
    afirmar((await campo('#ft-empresa')) === 'Copel Distribuição', 'empresa lida')
    afirmar(!!(await campo('#ft-linha')), 'linha digitável lida')
    await page.locator('button:has-text("Salvar conta a pagar")').click()
    await toast('Conta a pagar salva')
    await ate(() => page.url().endsWith('#/contas'), 'vai para /contas')
    await ate(async () => (await page.locator('.card:has(h3:has-text("Contas do mês")) button.row:has-text("Luz — Copel"):has-text("R$ 412,37")').count()) > 0, 'conta aparece em /contas')
  })

  // 6 ---------------------------------------------------------------
  await passo(6, 'Assistente: perguntas, lançamento, chips, rotinas e alertas', async () => {
    await ir('assistente')
    const entrada = page.locator('input[aria-label="Mensagem"]')
    const bots = () => page.locator('.msg.bot:not([role="status"])')
    const meus = () => page.locator('.msg.me')
    await ate(async () => (await page.locator('.suggest button').count()) > 0, 'sugestões carregadas')
    // respondeu = minha mensagem entrou, o "pensando" sumiu e a última bolha é do assistente
    const respondeu = (n) => ate(async () => (await meus().count()) === n + 1 && (await page.locator('.msg[role="status"]').count()) === 0 && (await page.locator('.msg').last().evaluate((e) => e.classList.contains('bot'))), 'resposta do assistente', 15000)
    const pergunta = async (texto) => {
      const n = await meus().count()
      await entrada.fill(texto); await entrada.press('Enter')
      await respondeu(n)
      return bots().last()
    }
    let r = await pergunta('Quanto gastamos com delivery este mês?')
    afirmar((await r.locator('.mini .hb').count()) >= 2, 'mini-barras na resposta de delivery')
    afirmar(/Delivery/.test(await r.textContent()), 'resposta fala de Delivery')
    r = await pergunta('gastei 45 na padaria no pix')
    afirmar((await r.locator('.tag:has-text("lançado")').count()) === 1, 'etiqueta lançado')
    afirmar(/R\$\s?45,00/.test(await r.textContent()), 'lançou 45,00')
    await toast('Lançado pelo assistente')
    r = await pergunta('Quais assinaturas temos?')
    afirmar(/assinaturas/i.test(await r.textContent()), 'resposta de assinaturas')
    r = await pergunta('Dá para fechar a viagem de julho?')
    afirmar(/Viagem de julho/.test(await r.textContent()), 'resposta sobre o projeto')
    // chip de sugestão
    const nMe = await meus().count()
    await page.locator('.suggest button').first().click()
    await respondeu(nMe)
    afirmar((await meus().last().textContent()) === (await page.locator('.suggest button').first().textContent()), 'chip de sugestão vira mensagem')

    // rotina
    const interruptor = page.locator('.routine button.switch').first()
    const estado = await interruptor.getAttribute('aria-checked')
    await interruptor.click()
    await ate(async () => (await interruptor.getAttribute('aria-checked')) !== estado, 'interruptor alterna')
    await interruptor.click()
    await ate(async () => (await interruptor.getAttribute('aria-checked')) === estado, 'interruptor volta')

    // alertas: criar, editar, excluir
    await page.locator('button:has-text("Novo alerta")').click()
    await ate(async () => (await folha().count()) > 0, 'folha novo alerta')
    await page.locator('#al-limite').fill('300')
    await page.locator('button:has-text("Salvar alerta")').click()
    await toast('Alerta salvo')
    const linha = page.locator('button.row[aria-label="Editar alerta Delivery acima de R$ 300/mês"]')
    await ate(async () => (await linha.count()) === 1, 'alerta criado na lista')
    await linha.click()
    await page.locator('#al-nome').fill('Alerta E2E')
    await page.locator('button:has-text("Salvar alerta")').click()
    await toast('Alerta salvo')
    const editada = page.locator('button.row[aria-label="Editar alerta Alerta E2E"]')
    await ate(async () => (await editada.count()) === 1, 'alerta editado')
    await editada.click()
    await page.locator('.folha button:has-text("Excluir")').click()
    await toast('Alerta excluído')
    await ate(async () => (await editada.count()) === 0, 'alerta excluído da lista')
  })

  // 7 ---------------------------------------------------------------
  await passo(7, 'Caixa de entrada: chip, Outras…, Ignorar, importar fatura CSV', async () => {
    await ir('caixa')
    const pendentes = () => page.locator('.card:has-text("qual é a despesa?")')
    await ate(async () => (await pendentes().count()) === 4, '4 pendentes')
    const aba = page.locator('[role="tab"]:has-text("Pendentes")')
    afirmar(/\(4\)/.test(await aba.textContent()), 'contador 4 na aba')
    const primeiro = pendentes().first()
    const loja = await primeiro.locator('span[style*="font-weight: 500"]').first().textContent()
    await primeiro.locator('.chip[aria-pressed="true"]').click()
    await toast('Lançado')
    await ate(async () => (await pendentes().count()) === 3, 'pendente some')
    await ate(async () => /\(3\)/.test(await aba.textContent()), 'contador cai para 3')
    afirmar((await pendentes().filter({ hasText: loja }).count()) === 0, 'o item resolvido não está mais na lista')
    if (!movel) afirmar((await page.locator('.side .nav a:has-text("Caixa de entrada") .badge').textContent()) === '3', 'badge da lateral = 3')

    await pendentes().first().locator('.chip[aria-label="Outras categorias"]').click()
    await ate(async () => (await folha().locator('.chip').count()) > 0, 'cardápio completo')
    await folha().locator('.chip:has-text("Farmácia")').first().click()
    await toast('Farmácia')
    await ate(async () => (await pendentes().count()) === 2, 'resolvido por Outras…')
    await pendentes().first().locator('button:has-text("Ignorar")').click()
    await toast('Item ignorado')
    await ate(async () => (await pendentes().count()) === 1, 'ignorado some')
    await page.locator('[role="tab"]:has-text("Resolvidos")').click()
    await ate(async () => (await page.locator('.card .tag:has-text("ignorado")').count()) === 1 && (await page.locator('.card .tag:has-text("lançado")').count()) === 2, 'aba Resolvidos')
    await page.locator('[role="tab"]:has-text("Pendentes")').click()

    await fecharToasts()
    await page.locator('button:has-text("Importar fatura")').click()
    await ate(async () => (await page.locator('#imp-cartao').count()) === 1, 'folha importar')
    await page.locator('input[aria-label="Arquivo da fatura"]').setInputFiles({ name: 'fatura.csv', mimeType: 'text/csv', buffer: Buffer.from('17/10/2026;SUPERMERCADO CONDOR;312,50\n') })
    const compra = folha().locator('button.row:has-text("SUPERMERCADO CONDOR")')
    await ate(async () => (await compra.count()) === 1, 'compra lida do CSV')
    afirmar(/R\$\s?312,50/.test(await compra.textContent()), 'valor 312,50')
    afirmar((await compra.getAttribute('aria-pressed')) === 'true', 'compra marcada')
    await page.locator('button:has-text("Trazer 1 para a Caixa")').click()
    await toast('1 compra na Caixa de entrada')
    await ate(async () => (await pendentes().count()) === 2, 'importada vira pendente')
    afirmar((await pendentes().filter({ hasText: 'SUPERMERCADO CONDOR' }).count()) === 1, 'item importado na Caixa')
  })

  // 8 ---------------------------------------------------------------
  await passo(8, 'Contas: abas 30/60/90, copiar código, marcar como paga', async () => {
    await ir('contas')
    for (const d of [60, 90, 30]) {
      await page.locator(`.tabs [role="tab"]:has-text("${d} dias")`).click()
      await ate(async () => (await page.locator(`.tabs [role="tab"][aria-selected="true"]:has-text("${d} dias")`).count()) === 1, `aba ${d}`)
      await ate(async () => new RegExp(`em ${d} dias`).test(await page.locator('.card h3:has-text("Próximas saídas") .sub').textContent()), `total em ${d} dias`)
    }
    const linha = page.locator('.card:has(h3:has-text("Contas do mês")) button.row:has-text("Luz — Copel"):has-text("R$ 412,37")')
    await ate(async () => (await linha.count()) > 0, 'conta de Luz salva no passo 5')
    afirmar(!/paga em/.test(await linha.first().textContent()), 'conta ainda aberta')
    await linha.first().click()
    await ate(async () => (await folha().count()) > 0, 'detalhe da conta')
    await folha().locator('button:has-text("Copiar código de barras")').click()
    await dormir(300)
    await folha().locator('button:has-text("Marcar como paga")').click()
    await folha().locator('.seg button:has-text("Pix")').click()
    await folha().locator('button:has-text("Confirmar pagamento")').click()
    await toast('marcada como paga')
    await semFolha()
    await ate(async () => /paga em/.test(await linha.first().textContent()), 'status muda para paga')
    await ir('tipo/t_fixas?categoria=c_luz')
    await ate(async () => (await page.locator('#cat-c_luz .row:has-text("R$ 412,37")').count()) > 0, 'lançamento em Despesas fixas › Luz')
  })

  // 9 ---------------------------------------------------------------
  await passo(9, 'Projetos: aporte, simulador, propor → Conselho → votar → encerrar', async () => {
    await ir('projetos')
    await page.locator('a.card.proj:has-text("Viagem de julho")').click()
    const big = page.locator('article.card.proj .big')
    await ate(async () => (await big.count()) === 1, 'detalhe do projeto')
    const antes = numeroDe(await big.textContent())
    await page.locator('button:has-text("Registrar aporte")').click()
    await page.locator('#ap-valor').fill('500')
    await page.locator('.folha button[type="submit"]:has-text("Registrar aporte")').click()
    await toast('Aporte de R$ 500,00 registrado')
    await ate(async () => numeroDe(await big.textContent()) === antes + 500, `total sobe 500 (antes ${antes})`)
    afirmar((await page.locator('section[aria-labelledby="aportes-t"] .row:has-text("R$ 500,00")').count()) > 0, 'aporte listado')

    const texto = () => page.locator('section[aria-labelledby="sim-t"] p.num').first().textContent()
    afirmar(/R\$\s?130\/mês/.test(await texto()), 'simulador começa em 130')
    const slider = page.locator('#sim-corte')
    await slider.fill('500')
    await ate(async () => /R\$\s?500\/mês/.test(await texto()), 'texto do simulador muda com o slider')
    afirmar(/a meta fecha em|não fecha/.test(await texto()), 'frase do simulador')

    await ir('projetos')
    await visivel(page.locator('button:has-text("Propor projeto")')).click()
    await page.locator('#pj-nome').fill('Piano da Nina')
    await page.locator('#pj-meta').fill('3000')
    await page.locator('button[role="switch"][aria-label="Levar ao Conselho antes de começar"]').click()
    await page.locator('button:has-text("Enviar ao Conselho")').click()
    await toast('Proposta enviada ao Conselho')
    await ate(async () => (await page.locator('a.card.proj:has-text("Piano da Nina") .tag:has-text("Em votação")').count()) === 1, 'projeto em votação na lista')

    await ir('conselho')
    const card = page.locator('article.card:has-text("Novo projeto: Piano da Nina")')
    await ate(async () => (await card.count()) === 1, 'proposta aberta no Conselho')
    afirmar(/7 dias/.test(await card.locator('h3 .tag').textContent()), 'prazo de 7 dias')
    await card.locator('[role="radio"]:has-text("Sim")').click()
    await card.locator('button:has-text("Votar")').click()
    await toast('Voto registrado')
    await ate(async () => /Seu voto: Sim/.test(await card.textContent()), 'voto Sim registrado')
    await card.locator('button:has-text("Encerrar votação")').click()
    await toast('proposta aprovada')
    await ate(async () => (await card.count()) === 0, 'sai das abertas')
    await page.locator('[role="tab"]:has-text("Encerradas")').click()
    await ate(async () => (await page.locator('article.card:has-text("Novo projeto: Piano da Nina") .tag:has-text("Aprovada")').count()) === 1, 'aprovada nas encerradas')
    await ir('projetos')
    const tag = page.locator('a.card.proj:has-text("Piano da Nina") .tag')
    await ate(async () => (await tag.count()) === 1 && !/Em votação/.test(await tag.textContent()), 'projeto fica ativo')
    await page.locator('a.card.proj:has-text("Piano da Nina")').click()
    await ate(async () => (await page.locator('button:has-text("Registrar aporte")').count()) === 1, 'projeto ativo aceita aportes')
  })

  // 10 --------------------------------------------------------------
  await passo(10, 'Reunião, Patrimônio e Mesada (Júlia) + restrições do Dependente', async () => {
    await ir('reuniao')
    await ate(async () => (await page.locator('section.card:has-text("1. Como fechou o mês")').count()) === 1, 'pauta em cartões')
    afirmar((await page.locator('section.card').count()) >= 8, 'cartões da pauta')
    await page.locator('textarea[aria-label="O que decidimos"]').fill('Reduzir delivery para R$ 250.')
    await page.locator('button:has-text("Salvar ata")').click()
    await toast('Ata salva')
    await ate(async () => (await page.locator('.tag:has-text("Ata salva em")').count()) === 1, 'etiqueta de ata salva')

    await ir('patrimonio')
    const item = page.locator('section[aria-labelledby="pat-itens"] button.row').first()
    await ate(async () => (await item.count()) === 1, 'itens do patrimônio')
    const nome = await item.locator('.t b').textContent()
    await item.click()
    await page.locator('#sd-valor').fill('12345')
    await page.locator('button:has-text("Salvar saldo")').click()
    await toast('atualizado')
    await ate(async () => (await page.locator(`section[aria-labelledby="pat-itens"] button.row:has-text("${nome}"):has-text("R$ 12.345,00")`).count()) === 1, 'saldo atualizado na lista')

    await entrarComo('u_julia', 'tok_ju_demo')
    afirmar((await cards().count()) === 3, 'Painel do Dependente com 3 cards')
    afirmar((await page.locator('.gcard:has-text("Minha mesada")').count()) === 1, 'card da mesada')
    if (movel) {
      afirmar((await page.locator('.bottom a:has-text("Caixa")').count()) === 1 && (await page.locator('.bottom a:has-text("Contas")').count()) === 0, 'barra inferior sem Contas')
    } else {
      afirmar((await page.locator('.side .nav a:has-text("Contas a pagar")').count()) === 0, 'lateral sem Contas')
      afirmar((await page.locator('.side select.member').count()) === 0, 'lateral sem Visão')
    }
    await ir('contas')
    await ate(async () => (await page.locator('.card:has-text("Área dos adultos")').count()) === 1, 'Área dos adultos')
    await ir('mesada')
    await ate(async () => (await page.locator('h2:has-text("Minha mesada")').count()) === 1, 'Minha mesada')
    const saldo = page.locator('section[aria-labelledby="mes-t"] .big')
    await ate(async () => /R\$/.test((await saldo.textContent()) || ''), 'saldo em R$')
    const saldoAntes = numeroDe(await saldo.textContent())
    await page.locator('section[aria-labelledby="mes-t"] a:has-text("Lançar despesa")').click()
    await ate(() => page.url().endsWith('#/lancar'), 'vai para Lançar')
    afirmar((await page.locator('.method:has-text("Enviar fatura")').count()) === 0, 'Dependente não vê Enviar fatura')
    await page.locator('.method:has-text("Digitar")').click()
    await page.locator('#valor').fill('1200')
    await page.locator('.chips .chip:has-text("Padaria")').first().click()
    afirmar(await page.locator('#quem').isDisabled(), 'Quem gastou travado para o Dependente')
    await page.locator('button:has-text("Confirmar lançamento")').click()
    await toast('Lançado')
    await ir('mesada')
    await ate(async () => numeroDe(await saldo.textContent()) === Math.round((saldoAntes - 12) * 100) / 100, 'saldo cai 12,00')
    afirmar((await page.locator('section[aria-labelledby="gastos-t"] .row:has-text("R$ 12,00")').count()) === 1, 'gasto listado')
    await page.locator('button:has-text("Guardar em um projeto")').click()
    await page.locator('#gd-valor').fill('5')
    await page.locator('.folha button[type="submit"]:has-text("Guardar")').click()
    await toast('R$ 5,00 guardados no projeto')
    await ate(async () => /R\$\s?/.test(await page.locator('section[aria-labelledby="mes-t"] dd:has(svg)').textContent()), 'cofrinho renderiza')
    await entrarComo('u_luiz', 'tok_pai_demo')
  })

  // 11 --------------------------------------------------------------
  await passo(11, 'Configurações: seções, Cardápio, Membros, Acessibilidade, Fé, Brasão, Captura', async () => {
    const secoes = { identidade: 'Identidade da família', membros: 'Membros e convites', fe: 'Fé e decisões', cardapio: 'Cardápio', orcamento: 'Orçamento', 'contas-fixas': 'Contas fixas', cartoes: 'Cartões', rotinas: 'Rotinas e alertas', acessibilidade: 'Acessibilidade', dados: 'Dados e backup' }
    await ir('configuracoes')
    await ate(async () => (await page.locator('.rows a.row').count()) >= 10, 'índice de Configurações')
    for (const [id, nome] of Object.entries(secoes)) {
      await ir(`configuracoes/${id}`)
      await ate(async () => (await page.locator(`.topbar h2:text-is("${nome}")`).count()) === 1, `seção ${nome}`)
      await ate(async () => (await page.locator('.card').count()) >= 1 && (await page.locator('[role="status"]:has-text("Carregando")').count()) === 0, `${nome} carregada`)
    }
    await ir('configuracoes/captura')
    await ate(() => page.url().endsWith('#/captura'), 'captura redireciona')

    // Cardápio: nova categoria com ícone
    await ir('configuracoes/cardapio')
    await page.locator('[role="tab"]:has-text("Despesas variáveis")').click()
    await page.locator('button.row:has-text("Nova categoria em Alimentação")').click()
    await ate(async () => (await folha().count()) > 0, 'folha nova categoria')
    await folha().locator('input.campo').first().fill('Sorveteria E2E')
    await folha().locator('[role="radio"][aria-label="croissant"]').click()
    await folha().locator('button:has-text("Salvar")').click()
    await toast('Categoria salva')
    await semFolha()
    afirmar((await page.locator('button.row:has-text("Sorveteria E2E") svg.lucide-croissant').count()) === 1, 'categoria listada com o ícone')
    await ir('lancar')
    await page.locator('.method:has-text("Digitar")').click()
    await ate(async () => (await page.locator('.chip:has-text("Sorveteria E2E") svg.lucide-croissant').count()) === 1, 'nova categoria no cardápio do Lançar')

    // Membros: convite com QR
    await ir('configuracoes/membros')
    await page.locator('button:has-text("Gerar convite")').click()
    const qr = page.locator('svg[aria-label="QR Code do convite"] path')
    await ate(async () => ((await qr.getAttribute('d')) || '').length > 200, 'QR renderiza')
    afirmar(/#\/entrar\?convite=[A-Z0-9]{6}&perfil=Adulto&demo=1/.test(await campo('input[aria-label="Link do convite"]')), 'link do convite')

    // Acessibilidade
    await ir('configuracoes/acessibilidade')
    const raiz = () => page.evaluate(() => ({ tema: document.documentElement.dataset.tema, base: getComputedStyle(document.documentElement).getPropertyValue('--base').trim() }))
    await page.locator('.seg button:has-text("Claro")').click()
    await ate(async () => (await raiz()).tema === 'claro', 'data-tema=claro')
    afirmar(JSON.parse(await page.evaluate(() => localStorage.getItem('ff_preferencias'))).tema === 'claro', 'tema persistido')
    await page.getByRole('button', { name: 'Grande', exact: true }).click()
    await ate(async () => (await raiz()).base === (movel ? '17px' : '16px'), '--base muda com letra grande')
    await page.locator('.seg button:has-text("Escuro")').click()
    await page.getByRole('button', { name: 'Normal', exact: true }).click()
    await ate(async () => (await raiz()).tema === 'escuro' && (await raiz()).base === (movel ? '15px' : '14px'), 'volta ao padrão')

    // Fé: desligar versículo
    await ir('configuracoes/fe')
    afirmar((await page.locator('.side .verse').count()) === 1, 'versículo na lateral antes')
    await page.locator('button[role="switch"][aria-label="Versículo do dia"]').click()
    await page.locator('button:has-text("Salvar")').click()
    await toast('Preferências salvas')
    await ate(async () => (await page.locator('.side .verse').count()) === 0, 'versículo some da lateral')
    await page.locator('button[role="switch"][aria-label="Versículo do dia"]').click()
    await page.locator('button:has-text("Salvar")').click()
    await toast('Preferências salvas')
    await ate(async () => (await page.locator('.side .verse').count()) === 1, 'versículo volta')

    // Brasão
    await ir('brasao')
    const previa = page.locator('img[alt="Prévia do brasão"]')
    const srcAntes = await previa.getAttribute('src')
    await page.locator('.card:has(h3:has-text("Escudo")) .seg button').nth(1).click()
    await page.locator('.card:has(h3:has-text("Móvel e iniciais")) .chips .chip').nth(2).click()
    await page.locator('.card:has(h3:has-text("Móvel e iniciais")) input.campo').first().fill('LNR')
    await ate(async () => (await previa.getAttribute('src')) !== srcAntes, 'prévia muda com as opções')
    await page.locator('button:has-text("Usar como brasão da família")').click()
    await toast('Brasão da família atualizado')
    await ate(() => page.url().endsWith('#/configuracoes/identidade'), 'volta à Identidade')
    const crest = page.locator(movel ? '.mhead .crest img' : '.side .crest img')
    await ate(async () => ((await crest.getAttribute('src')) || '').startsWith('data:image/svg+xml'), 'brasão da lateral/cabeçalho muda')

    // Captura: simulador de SMS
    await ir('captura')
    await page.locator('textarea[aria-label="SMS para simular"]').fill('Compra aprovada no seu Itaú final 4821: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.')
    await page.locator('button:has-text("Simular")').click()
    await ate(async () => (await page.locator('.row:has-text("Valor") .amt:has-text("R$ 87,40")').count()) === 1, 'valor extraído do SMS')
    afirmar((await page.locator('.row:has-text("Loja") .amt:has-text("PADARIA PAO QUENTE")').count()) === 1, 'loja extraída')
    afirmar((await page.locator('.row:has-text("Banco") .amt:has-text("Itaú")').count()) === 1, 'banco Itaú')
  })

  // 12 --------------------------------------------------------------
  await passo(12, 'Entrar: perfil lembrado + PIN 1234 e convite demo', async () => {
    await page.evaluate(() => localStorage.removeItem('ff_sessao'))
    await page.goto(`${base}#/`)
    await page.reload()
    await ate(async () => (await page.locator('h2:has-text("Quem é você?")').count()) === 1, 'perfis lembrados')
    await page.locator('.capa button:has-text("Luiz")').click()
    await ate(async () => (await page.locator('.teclado').count()) === 1, 'teclado de PIN')
    await digitarPin('.capa', '1234')
    await esperarPainel(4)
    afirmar(JSON.parse(await page.evaluate(() => localStorage.getItem('ff_sessao'))).usuario_id === 'u_luiz', 'sessão do Luiz')

    await page.evaluate(() => localStorage.removeItem('ff_sessao'))
    await page.goto(`${base}#/entrar?convite=ABC123&perfil=Adulto&demo=1`)
    await page.reload()
    await ate(async () => (await page.locator('h2:has-text("Instalar na tela inicial")').count()) === 1, 'convite abre')
    await page.locator('button:has-text("Continuar no navegador")').click()
    await page.locator('#cv-nome').fill('Beatriz Reis')
    await page.locator('#cv-apelido').fill('Bia')
    await page.locator('[role="radio"][aria-label="green"]').click()
    afirmar(/Perfil: Adulto · modo demonstração/.test(await page.locator('.capa .card').textContent()), 'perfil do convite')
    await page.locator('button[type="submit"]:has-text("Continuar")').click()
    await ate(async () => (await page.locator('h2:has-text("Escolha um PIN")').count()) === 1, 'tela do PIN')
    await digitarPin('.capa', '1234')
    await ate(async () => (await page.locator('h2:has-text("Repita o PIN")').count()) === 1, 'confirmação do PIN')
    await digitarPin('.capa', '1234')
    await esperarPainel(4)
    const s = JSON.parse(await page.evaluate(() => localStorage.getItem('ff_sessao')))
    afirmar(s.usuario_id && s.usuario_id !== 'u_luiz' && s.token, 'sessão do novo usuário criada')
    await ir('configuracoes')
    await ate(async () => (await page.locator('.card:has-text("Beatriz Reis") .tag:has-text("Adulto")').count()) === 1, 'perfil Adulto em Configurações')
    await entrarComo('u_luiz', 'tok_pai_demo')
  })

  // 13 --------------------------------------------------------------
  await passo(13, 'Offline: lançar por Digitar sem internet', async () => {
    await ir('')
    await esperarPainel(4)
    await contexto.setOffline(true)
    try {
      await ate(async () => (await page.locator('.conteudo .card:has-text("Sem internet")').count()) === 1, 'aviso de sem internet', 5000)
      await lancarDigitando({ centavos: '990', chip: 'Padaria' })
      afirmar((await page.locator('.conteudo .card:has-text("Sem internet")').count()) === 1, 'aviso continua enquanto offline')
    } finally {
      await contexto.setOffline(false)
    }
    await ate(async () => (await page.locator('.conteudo .card:has-text("Sem internet")').count()) === 0, 'aviso some ao voltar')
    await page.locator('a:has-text("Voltar ao Painel")').click()
    await esperarPainel(4)
  })

  await navegador.close()
  return { falhas, errosPagina }
}

const tamanhos = process.env.TAMANHO === 'desktop' ? [false] : process.env.TAMANHO === 'movel' ? [true] : [true, false]
let totalFalhas = 0
for (const movel of tamanhos) {
  console.log(`\n== ${movel ? 'Celular 390×844' : 'Computador 1440×900'} ==`)
  const { falhas, errosPagina } = await rodar(movel)
  totalFalhas += falhas.length
  for (const f of falhas) console.log(`  FALHA ${f.passo}\n    ${f.erro}\n    print: ${f.print}`)
  const soltos = errosPagina.filter((e) => !falhas.some((f) => f.passo === e.passo))
  for (const e of soltos) console.log(`  ERRO DE PÁGINA fora de passo (${e.passo}): ${e.texto}`)
  totalFalhas += soltos.length
}
servidor.close()
console.log(totalFalhas ? `\n${totalFalhas} falha(s).` : '\nRoteiro completo sem falhas.')
process.exit(totalFalhas ? 1 : 0)
