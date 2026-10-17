/**
 * Testes do back-end (sem dependências externas): node apps-script/testes/executar.mjs
 *
 *  1. Confere a sintaxe de TODOS os .gs (compila cada um com vm.Script).
 *  2. Carrega os arquivos num contexto com stubs mínimos de Utilities/PropertiesService/CacheService/
 *     LockService e testa as funções puras: parser de SMS, hash_dedup, parcelas, regra de votação,
 *     sugestão de categoria, leitura de fatura OFX/CSV, regex de OCR/NFC-e, PIN.
 *  3. Confere que obterAcoes() cobre todas as ações de docs/API.md.
 */
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.join(raiz, '..')

// ---------- Stubs do Apps Script ----------
const props = new Map()
const cache = new Map()
const dois = (n) => String(n).padStart(2, '0')
const sandbox = {
  console,
  Logger: { log: () => {} },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: (alg, texto) => Array.from(crypto.createHash('sha256').update(texto, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
    formatDate: (d, tz, fmt) => {
      const data = `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
      return fmt.includes('HH') ? `${data}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}` : data
    },
    base64Encode: (b) => Buffer.from(b).toString('base64'),
    base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => props.set(k, v),
      deleteProperty: (k) => props.delete(k),
      getProperties: () => Object.fromEntries(props),
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => cache.set(k, v),
      putAll: (o) => Object.entries(o).forEach(([k, v]) => cache.set(k, v)),
      getAll: (ks) => Object.fromEntries(ks.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
      remove: (k) => cache.delete(k),
      removeAll: (ks) => ks.forEach((k) => cache.delete(k)),
    }),
  },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
}
const ctx = vm.createContext(sandbox)

// ---------- 1. Sintaxe e carga ----------
let total = 0, falhas = 0
function teste(nome, fn) {
  total++
  try { fn(); console.log('  ok   ' + nome) } catch (e) { falhas++; console.log('  FALHA ' + nome + '\n        ' + (e.message || e).split('\n')[0]) }
}

console.log('1) Sintaxe dos arquivos .gs')
const arquivos = fs.readdirSync(raiz).filter((f) => f.endsWith('.gs'))
const ordem = ['util.gs', 'bd.gs', ...arquivos.filter((f) => f !== 'util.gs' && f !== 'bd.gs').sort()]
const scripts = []
for (const nome of ordem) {
  teste(nome, () => { scripts.push(new vm.Script(fs.readFileSync(path.join(raiz, nome), 'utf8'), { filename: nome })) })
}
console.log('   Carregando no contexto…')
for (const s of scripts) s.runInContext(ctx)
const g = ctx

// ---------- 2. Funções puras ----------
console.log('2) Parser de SMS')
const amostras = [
  ['Itaú', 'Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12', 87.4, 'PADARIA PAO QUENTE', '4321'],
  ['Nubank', 'Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765.', 156.9, 'DROGARIA NISSEI', '8765'],
  ['Bradesco', 'BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 17/10 10:00 NO VALOR DE R$ 50,00 EM MERCADO X.', 50, 'MERCADO X', '1234'],
  ['Santander', 'Santander: compra aprovada cartao final 1234 R$ 50,00 MERCADO X 17/10 10:00', 50, 'MERCADO X', '1234'],
  ['Banco do Brasil', 'BB: Compra aprovada R$ 50,00 em MERCADO X cartao final 1234 17/10 10:00', 50, 'MERCADO X', '1234'],
  ['Caixa', 'CAIXA: Compra aprovada no cartao final 1234, R$ 50,00, MERCADO X, 17/10', 50, 'MERCADO X', '1234'],
  ['Inter', 'Inter: compra aprovada de R$ 50,00 em MERCADO X no cartao final 1234', 50, 'MERCADO X', '1234'],
  ['C6', 'C6 Bank: Compra aprovada R$ 50,00 MERCADO X final 1234', 50, 'MERCADO X', '1234'],
  ['Genérico', 'Alerta de compra: R$ 1.210,00 em POSTO SHELL cartao final 9999', 1210, 'POSTO SHELL', '9999'],
]
for (const [banco, texto, valor, est, fim] of amostras) {
  teste(`lerSms ${banco}`, () => {
    const r = g.lerSms(texto)
    assert.equal(r.valido, true, r.motivo)
    assert.equal(r.banco, banco)
    assert.equal(r.valor, valor)
    assert.equal(r.estabelecimento, est)
    assert.equal(r.final_cartao, fim)
  })
}
teste('lerSms ignora código de verificação (OTP)', () => { const r = g.lerSms('Seu código de verificação Itaú é 482913. Não compartilhe.'); assert.equal(r.valido, false) })
teste('lerSms ignora propaganda', () => { assert.equal(g.lerSms('Nubank: oferta especial! Clique e ganhe cashback de R$ 50,00 em compras.').valido, false) })
teste('lerSms ignora estorno', () => { assert.equal(g.lerSms('Itaú: estorno de R$ 50,00 em MERCADO X cartao final 1234').valido, false) })
teste('lerSms detecta parcelas', () => { const r = g.lerSms('Compra aprovada no seu Itaú final 4321: R$ 300,00 em LOJA X em 3x em 17/10 às 08:12'); assert.equal(r.parcelas, '1/3') })
teste('lerSms mensagem vazia', () => { assert.equal(g.lerSms('').valido, false) })
teste('sanitizarTextoSms mascara números longos', () => { assert.equal(g.sanitizarTextoSms('final 4321 codigo 123456'), 'final 4321 codigo •••••') })

console.log('3) Valor, data, forma e frase ditada')
teste('extrairValor "gastei 45 reais"', () => assert.equal(g.extrairValor('gastei 45 reais na padaria'), 45))
teste('extrairValor "R$ 1.234,56"', () => assert.equal(g.extrairValor('paguei R$ 1.234,56 no mercado'), 1234.56))
teste('extrairValor por extenso', () => assert.equal(g.extrairValor('quarenta e cinco reais de gasolina'), 45))
teste('extrairValor "cento e vinte"', () => assert.equal(g.extrairValor('cento e vinte reais'), 120))
teste('extrairValor "45 e 50"', () => assert.equal(g.extrairValor('gastei 45 e 50 na feira'), 45.5))
teste('extrairFormaPgto', () => { assert.equal(g.extrairFormaPgto('paguei no pix'), 'pix'); assert.equal(g.extrairFormaPgto('no débito'), 'débito'); assert.equal(g.extrairFormaPgto('parcelado'), 'crédito') })
teste('extrairData "12/03"', () => assert.equal(g.extrairData('comprei dia 12/03'), `${new Date().getFullYear()}-03-12`))
teste('extrairData ontem', () => { const d = new Date(); d.setDate(d.getDate() - 1); assert.equal(g.extrairData('ontem gastei 10'), g.dataParaIso(d)) })
const categorias = g.dadosIniciaisCategorias()
teste('extrairDeTexto frase ditada', () => {
  const r = g.extrairDeTexto('gastei 45 reais na padaria no pix', categorias)
  assert.equal(r.valor, 45); assert.equal(r.forma_pgto, 'pix'); assert.equal(r.categoria_id, 'c_padaria'); assert.equal(r.confianca, 0.7)
})
teste('extrairDeTexto receita', () => { const r = g.extrairDeTexto('recebi 500 reais de freela', categorias); assert.equal(r.categoria_id, 'c_renda_extra') })
teste('extrairDeTexto SMS vira crédito com confiança 0.8', () => { const r = g.extrairDeTexto(amostras[0][1], categorias); assert.equal(r.forma_pgto, 'crédito'); assert.equal(r.categoria_id, 'c_padaria') })

console.log('4) Sugestão de categoria')
teste('PADARIA → c_padaria em 1º', () => assert.equal(g.sugerirCategoria('PADARIA PAO QUENTE', categorias)[0], 'c_padaria'))
teste('DROGARIA NISSEI → c_farmacia', () => assert.equal(g.sugerirCategoria('DROGARIA NISSEI', categorias)[0], 'c_farmacia'))
teste('POSTO SHELL → c_combustivel', () => assert.equal(g.sugerirCategoria('POSTO SHELL', categorias)[0], 'c_combustivel'))
teste('no máximo 6 sugestões, completadas com padrão', () => { const s = g.sugerirCategoria('xyz', categorias); assert.equal(s.length, 6); assert.equal(s[0], 'c_mercado') })
teste('ignora categorias inativas', () => { const s = g.sugerirCategoria('PADARIA', categorias.map((c) => (c.id === 'c_padaria' ? { ...c, ativa: false } : c))); assert.notEqual(s[0], 'c_padaria') })

console.log('5) hash_dedup, normalização e datas')
function djb2(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
teste('hashDedup igual ao do app', () => {
  const esperado = djb2('87.40|2026-10-17|4321|PADARIA PAO QUENTE')
  assert.equal(g.hashDedup(87.4, '2026-10-17', '4321', 'Padaria Pão Quente'), esperado)
})
teste('hashDedup ignora acento/caixa e usa só a data', () => assert.equal(g.hashDedup(10, '2026-01-02T10:00:00', '', 'Café'), g.hashDedup(10, '2026-01-02', '', 'CAFE')))
teste('hashDedup muda com o valor', () => assert.notEqual(g.hashDedup(10, '2026-01-02', '', 'X'), g.hashDedup(10.01, '2026-01-02', '', 'X')))
teste('normalizar', () => assert.equal(g.normalizar('  Açaí & Cia — loja 2 '), 'ACAI CIA LOJA 2'))
teste('competenciaDe / somarMeses', () => { assert.equal(g.competenciaDe('2026-12-31'), '2026-12'); assert.equal(g.somarMeses('2026-12', 1), '2027-01'); assert.equal(g.somarMeses('2026-01', -1), '2025-12') })
teste('normalizarDataIso dd/mm/aaaa', () => assert.equal(g.normalizarDataIso('05/03/2026'), '2026-03-05'))
teste('diferencaDias', () => assert.equal(g.diferencaDias('2026-10-15', '2026-10-17'), 2))
teste('apenasFinalCartao nunca guarda o número inteiro', () => assert.equal(g.apenasFinalCartao('1234 5678 9012 3456'), '3456'))
teste('moeda', () => assert.equal(g.moeda(1234.5), 'R$ 1.234,50'))
teste('lerValor', () => { assert.equal(g.lerValor('1.234,56'), 1234.56); assert.equal(g.lerValor('45'), 45); assert.equal(g.lerValor('abc'), 0) })

console.log('6) Parcelas no cartão')
let n = 0
const gid = (p) => `${p}_${++n}`
teste('3x depois do fechamento começa no mês seguinte', () => {
  const base = { id: 'x', data: '2026-10-26', valor: 100, cartao_id: 'k' }
  const l = g.distribuirParcelas(base, 3, { dia_fechamento: 25 }, gid)
  // JSON.stringify porque arrays vindos do contexto vm não são "reference-equal" para deepEqual.
  assert.equal(JSON.stringify(l.map((x) => x.competencia)), JSON.stringify(['2026-11', '2026-12', '2027-01']))
  assert.equal(JSON.stringify(l.map((x) => x.valor)), JSON.stringify([33.33, 33.33, 33.34]))
  assert.equal(JSON.stringify(l.map((x) => x.parcela)), JSON.stringify(['1/3', '2/3', '3/3']))
  assert.equal(l.reduce((s, x) => s + x.valor, 0).toFixed(2), '100.00')
  assert.ok(l.every((x, i) => x.hash_dedup.endsWith('_' + i)))
})
teste('no dia do fechamento ainda cai no mês da compra', () => { const l = g.distribuirParcelas({ data: '2026-10-25', valor: 90 }, 2, { dia_fechamento: 25 }, gid); assert.equal(l[0].competencia, '2026-10') })
teste('sem cartão usa o mês da compra', () => { const l = g.distribuirParcelas({ data: '2026-10-30', valor: 90 }, 2, null, gid); assert.equal(l[0].competencia, '2026-10'); assert.equal(l[1].competencia, '2026-11') })

console.log('7) Regra de votação')
const votos = (lista) => lista.map(([u, v]) => ({ usuario_id: u, voto: v }))
teste('maioria: sim > não aprova', () => assert.equal(g.aplicarRegraVotacao(votos([['a', 'sim'], ['b', 'sim'], ['c', 'não']]), 'maioria', ['a']), true))
teste('maioria: empate recusa', () => assert.equal(g.aplicarRegraVotacao(votos([['a', 'sim'], ['b', 'não']]), 'maioria', []), false))
teste('abstenção não conta', () => assert.equal(g.aplicarRegraVotacao(votos([['a', 'sim'], ['b', 'abster'], ['c', 'abster']]), 'maioria', []), true))
teste('maioria_mais_pais: pai contra veta', () => assert.equal(g.aplicarRegraVotacao(votos([['pai', 'não'], ['f1', 'sim'], ['f2', 'sim']]), 'maioria_mais_pais', ['pai', 'mae']), false))
teste('maioria_mais_pais: pais a favor ou abstendo aprova', () => assert.equal(g.aplicarRegraVotacao(votos([['pai', 'abster'], ['mae', 'sim'], ['f1', 'sim'], ['f2', 'não']]), 'maioria_mais_pais', ['pai', 'mae']), true))

console.log('8) Fatura OFX/CSV e conciliação')
teste('lerFaturaTexto CSV', () => {
  const c = g.lerFaturaTexto('data;estabelecimento;valor\n17/10/2026;CONDOR SUPER CENTER;312,50\n2026-10-18;NETFLIX.COM;55.90\n18/10/2026;LOJA X 1/3;189,90')
  assert.equal(c.length, 3); assert.equal(c[0].data, '2026-10-17'); assert.equal(c[0].valor, 312.5); assert.equal(c[1].valor, 55.9); assert.equal(c[2].parcela, '1/3')
})
teste('lerFaturaTexto OFX', () => {
  const ofx = '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261017120000[-3:BRT]<TRNAMT>-312.50<MEMO>CONDOR SUPER CENTER</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001<TRNAMT>1500.00<MEMO>PAGAMENTO FATURA</STMTTRN>'
  const c = g.lerFaturaTexto(ofx)
  assert.equal(c.length, 1); assert.equal(c[0].data, '2026-10-17'); assert.equal(c[0].valor, 312.5); assert.equal(c[0].estabelecimento, 'CONDOR SUPER CENTER')
})
teste('compraJaExiste ±2 dias mesmo valor', () => {
  const lancs = [{ valor: 312.5, data: '2026-10-15', estabelecimento: 'Condor Super Center', cartao_id: 'k1', hash_dedup: 'zz' }]
  assert.equal(g.compraJaExiste({ valor: 312.5, data: '2026-10-17', estabelecimento: 'CONDOR SC' }, lancs, [], '4321', 'k1'), true)
  assert.equal(g.compraJaExiste({ valor: 312.5, data: '2026-10-18', estabelecimento: 'CONDOR SC' }, lancs, [], '4321', 'k1'), false)
  assert.equal(g.compraJaExiste({ valor: 312.5, data: '2026-10-17', estabelecimento: 'OUTRA' }, lancs, [], '', 'k9'), false)
})
teste('compraJaExiste contra a caixa de entrada', () => {
  const caixa = [{ valor: 87.4, data_compra: '2026-10-17', final_cartao: '4321', status: 'pendente', hash_dedup: 'q' }]
  assert.equal(g.compraJaExiste({ valor: 87.4, data: '2026-10-16', estabelecimento: 'PADARIA' }, [], caixa, '4321', ''), true)
  assert.equal(g.compraJaExiste({ valor: 87.4, data: '2026-10-16', estabelecimento: 'PADARIA' }, [], caixa.map((c) => ({ ...c, status: 'ignorado' })), '4321', ''), false)
})

console.log('9) OCR (regex), NFC-e e JSON do Claude')
teste('extrairDeTextoOcr conta de luz', () => {
  const r = g.extrairDeTextoOcr('COPEL DISTRIBUICAO S.A.\nCNPJ: 04.368.898/0001-06\nReferência: 09/2026\nConsumo 328 kWh\nVencimento: 10/10/2026\nTOTAL A PAGAR R$ 312,47\n83640000003 1 12470138000 0 00000012345 6 78901234567 8', 'conta')
  assert.equal(r.valor, 312.47); assert.equal(r.vencimento, '2026-10-10'); assert.equal(r.competencia, '2026-09'); assert.equal(r.consumo_valor, 328); assert.equal(r.consumo_unidade, 'kWh'); assert.ok(r.linha_digitavel.length > 40); assert.equal(r.cnpj, '04.368.898/0001-06')
})
teste('extrairDeTextoOcr cupom usa o maior valor se não achar TOTAL', () => { const r = g.extrairDeTextoOcr('PADARIA PAO QUENTE\n17/10/2026 08:12\nPAO 18,90\nLEITE 11,80\nCAFE 32,00', 'cupom'); assert.equal(r.valor, 32); assert.equal(r.data, '2026-10-17') })
teste('extrairDadosNfce', () => {
  const html = '<div id="u20" class="txtTopo">PADARIA PAO QUENTE LTDA</div><div>CNPJ: 12.345.678/0001-90</div><label>Valor a pagar R$:</label><span class="totalNumb txtMax">87,40</span> Emissão: 17/10/2026 08:12:33 Cartão de Débito'
  const r = g.extrairDadosNfce(html)
  assert.equal(r.valor, 87.4); assert.equal(r.estabelecimento, 'PADARIA PAO QUENTE LTDA'); assert.equal(r.cnpj, '12.345.678/0001-90'); assert.equal(r.data, '2026-10-17'); assert.equal(r.forma_pgto, 'débito')
})
teste('extrairJson tolera cerca ```json', () => assert.equal(JSON.stringify(g.extrairJson('```json\n{"valor": 1}\n```')), '{"valor":1}'))
teste('normalizarLeituraClaude cupom', () => { const r = g.normalizarLeituraClaude({ valor: '87.4', data: '17/10/2026', estabelecimento: 'Padaria', forma_pgto: 'pix', itens: [{ nome: 'Pão', valor: 5 }], confianca: 2 }, 'cupom'); assert.equal(r.valor, 87.4); assert.equal(r.data, '2026-10-17'); assert.equal(r.confianca, 1) })
teste('comprasDeTextoOcr', () => { const c = g.comprasDeTextoOcr('17/10 CONDOR SUPER CENTER 312,50\n01/10 PAGAMENTO FATURA -1.500,00\n18/10 LOJA X 1/3 189,90'); assert.equal(c.length, 2); assert.equal(c[1].parcela, '1/3') })

console.log('10) PIN e tokens')
teste('hashPin determinístico e dependente do sal', () => {
  const h1 = g.hashPin('1234', 'salA'), h2 = g.hashPin('1234', 'salA'), h3 = g.hashPin('1234', 'salB')
  assert.equal(h1, h2); assert.notEqual(h1, h3); assert.match(h1, /^[0-9a-f]{64}$/)
})
teste('compararConstante', () => { assert.equal(g.compararConstante('abc', 'abc'), true); assert.equal(g.compararConstante('abc', 'abd'), false); assert.equal(g.compararConstante('abc', 'ab'), false) })
teste('validarFormatoPin', () => { assert.throws(() => g.validarFormatoPin('12')); assert.equal(g.validarFormatoPin('1234'), '1234') })
teste('gerarCodigoConvite tem 6 caracteres sem 0/O/1/I', () => { for (let i = 0; i < 50; i++) assert.match(g.gerarCodigoConvite(), /^[A-HJ-NP-Z2-9]{6}$/) })
teste('convite guardado em Script Properties', () => {
  props.set('convite_ABC234', JSON.stringify({ codigo: 'ABC234', perfil: 'Adulto', expira_em: new Date(Date.now() + 1000).toISOString() }))
  assert.equal(g.lerConvite('abc234').perfil, 'Adulto')
})

console.log('11) Contrato: ações de docs/API.md × obterAcoes()')
teste('todas as ações do contrato estão roteadas', () => {
  const md = fs.readFileSync(path.join(repo, 'docs', 'API.md'), 'utf8')
  const doContrato = [...md.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]).filter((a) => a !== 'acao')
  const acoes = g.obterAcoes()
  const faltam = doContrato.filter((a) => !acoes[a])
  assert.equal(faltam.length, 0, 'faltam: ' + faltam.join(', '))
  for (const nome of Object.keys(acoes)) assert.equal(typeof acoes[nome].fn, 'function', nome + ' sem função')
  assert.ok(doContrato.length >= 50)
})
teste('dados iniciais: 5 grupos, 42 categorias, 68 versículos', () => { assert.equal(g.dadosIniciaisGrupos().length, 5); assert.equal(g.dadosIniciaisCategorias().length, 42); assert.equal(g.dadosIniciaisVersiculos().length, 68) })
teste('esquema cobre todas as abas', () => { const ordem = vm.runInContext('ORDEM_ABAS', ctx), esquema = vm.runInContext('ESQUEMA', ctx); assert.equal(ordem.length, 18); for (const aba of ordem) assert.ok(esquema[aba], aba) })

console.log(`\n${total - falhas}/${total} testes passaram${falhas ? ` — ${falhas} FALHA(S)` : ''}`)
process.exit(falhas ? 1 : 0)
