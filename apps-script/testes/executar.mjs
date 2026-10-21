/**
 * Testes do back-end (sem dependências externas): node apps-script/testes/executar.mjs
 *
 *  1. Confere a sintaxe de TODOS os .gs (compila cada um com vm.Script).
 *  2. Carrega os arquivos num contexto com stubs mínimos de Utilities/PropertiesService/CacheService/
 *     LockService e testa as funções puras: parser de SMS, hash_dedup, parcelas, regra de votação,
 *     sugestão de categoria, leitura de fatura OFX/CSV, regex de OCR/NFC-e, PIN.
 *  3. Confere que obterAcoes() cobre todas as ações de docs/API.md (inclusive a seção "Versão 2").
 *  4. Versão 2 (com um banco sintético em memória, sem planilha): esquema das abas novas, resumo do
 *     mês e painel (aportes fora das despesas, meses previstos), próximas saídas, vigia (fora do
 *     padrão, duplicada, assinatura nova, vencimentos), alertas, regras de loja, projetos calculados,
 *     respostas locais do assistente, barras do Claude, parser do /start do Telegram.
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
    base64EncodeWebSafe: (s) => (typeof s === 'string' ? Buffer.from(s, 'utf8') : Buffer.from(s)).toString('base64url'),
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
teste('montarLinkConvite usa o app publicado por padrão e um só parâmetro c (base64url)', () => {
  props.delete('URL_APP')
  const u = g.montarLinkConvite('ABC234', 'Administrador', 'https://script.google.com/macros/s/X/exec', 'tok&1')
  assert.ok(u.startsWith('https://luizmeloreis.github.io/Finan-as-familiares/#/entrar?c='))
  const c = u.split('?c=')[1]
  assert.match(c, /^[A-Za-z0-9_-]+$/)
  assert.deepEqual(JSON.parse(Buffer.from(c, 'base64url').toString('utf8')), { convite: 'ABC234', perfil: 'Administrador', api: 'https://script.google.com/macros/s/X/exec', familia: 'tok&1' })
  props.set('URL_APP', 'https://exemplo.com/app/')
  assert.ok(g.montarLinkConvite('ABC234', 'Adulto', '', '').startsWith('https://exemplo.com/app/#/entrar?c='))
  props.delete('URL_APP')
})
teste('pastaRaiz usa a pasta escolhida pela família quando acessível e grava ID_PASTA', () => {
  const ID = '1bRifuNP_-E256Gb64wIjPKrtkYSzNN4c'
  props.delete('ID_PASTA'); cache.delete('ID_PASTA')
  g.DriveApp = { getFolderById: (id) => { if (id !== ID) throw new Error('sem acesso'); return { getId: () => id } }, getRootFolder: () => { throw new Error('não deveria criar pasta nova') } }
  assert.equal(g.pastaRaiz().getId(), ID)
  assert.equal(props.get('ID_PASTA'), ID)
  // sem acesso à pasta escolhida: cria "Finanças da Família <Sobrenome>" na raiz
  props.delete('ID_PASTA'); cache.delete('ID_PASTA')
  g.DriveApp = { getFolderById: () => { throw new Error('sem acesso') }, getRootFolder: () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: (nome) => ({ getId: () => 'nova:' + nome }) }) }
  assert.equal(g.pastaRaiz().getId(), 'nova:Finanças da Família Melo Reis')
  delete g.DriveApp; props.delete('ID_PASTA'); cache.delete('ID_PASTA')
})
teste('urlDoAppWeb prefere /exec e, no editor (/dev), usa a URL_API memorizada', () => {
  props.delete('URL_API'); cache.delete('URL_API')
  g.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ID/dev' }) }
  assert.equal(g.urlDoAppWeb(), 'https://script.google.com/macros/s/ID/dev')
  props.set('URL_API', 'https://script.google.com/macros/s/PUB/exec')
  assert.equal(g.urlDoAppWeb(), 'https://script.google.com/macros/s/PUB/exec')
  g.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/NOVA/exec' }) }
  assert.equal(g.urlDoAppWeb(), 'https://script.google.com/macros/s/NOVA/exec')
  // memorizarUrlExec grava a URL pública vinda de uma requisição real
  props.delete('URL_API'); cache.delete('URL_API')
  g.memorizarUrlExec()
  assert.equal(props.get('URL_API'), 'https://script.google.com/macros/s/NOVA/exec')
  g.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ID/dev' }) }
  props.delete('URL_API'); cache.delete('URL_API'); g.memorizarUrlExec()
  assert.equal(props.has('URL_API'), false)
  delete g.ScriptApp; cache.delete('URL_API')
})
teste('testarImplantacao distingue JSON público de página de login', () => {
  g.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{"ok":true,"dados":{"versao":"2"}}' }) }
  assert.equal(g.testarImplantacao('https://script.google.com/macros/s/X/exec').ok, true)
  g.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '<!DOCTYPE html><html>login</html>' }) }
  const r = g.testarImplantacao('https://script.google.com/macros/s/X/exec')
  assert.equal(r.ok, false); assert.match(r.motivo, /login/)
  assert.equal(g.testarImplantacao('').ok, false)
  delete g.UrlFetchApp
})
teste('criarConvite grava convite ligado ao usuário indicado', () => {
  const c = g.criarConvite('Administrador', 'instalacao', 'u_admin')
  const lido = g.lerConvite(c.codigo)
  assert.equal(lido.usuario_id, 'u_admin'); assert.equal(lido.perfil, 'Administrador'); assert.equal(lido.criado_por, 'instalacao')
  assert.ok(new Date(lido.expira_em).getTime() > Date.now())
})
teste('convite guardado em Script Properties', () => {
  props.set('convite_ABC234', JSON.stringify({ codigo: 'ABC234', perfil: 'Adulto', expira_em: new Date(Date.now() + 1000).toISOString() }))
  assert.equal(g.lerConvite('abc234').perfil, 'Adulto')
})

console.log('11) Contrato: ações de docs/API.md × obterAcoes()')
const md = fs.readFileSync(path.join(repo, 'docs', 'API.md'), 'utf8')
const doContrato = [...md.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]).filter((a) => a !== 'acao')
const secaoV2 = md.slice(md.indexOf('## Versão 2'))
const doContratoV2 = [...secaoV2.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
const acoes = g.obterAcoes()
teste('todas as ações do contrato estão roteadas', () => {
  const faltam = doContrato.filter((a) => !acoes[a])
  assert.equal(faltam.length, 0, 'faltam: ' + faltam.join(', '))
  for (const nome of Object.keys(acoes)) assert.equal(typeof acoes[nome].fn, 'function', nome + ' sem função')
  assert.ok(doContrato.length >= 70)
})
teste('seção "Versão 2" do contrato: 16 ações novas, todas roteadas', () => {
  assert.ok(doContratoV2.length >= 16, 'v2 tem ' + doContratoV2.length)
  for (const a of ['listar_regras_loja', 'salvar_regra_loja', 'proximas_saidas', 'listar_avisos', 'marcar_aviso_lido', 'listar_alertas', 'salvar_alerta', 'excluir_alerta', 'assistente', 'assistente_sugestoes', 'listar_conversa', 'listar_patrimonio', 'salvar_patrimonio', 'registrar_saldo_patrimonio', 'relatorio_mensal', 'vincular_telegram']) assert.ok(doContratoV2.includes(a) && acoes[a], a)
  assert.ok(acoes.listar_reunioes, 'listar_reunioes (usada pelo app) roteada')
})
teste('toda ação roteada está documentada (exceto listar_reunioes)', () => {
  const extras = Object.keys(acoes).filter((a) => !doContrato.includes(a) && a !== 'listar_reunioes')
  assert.equal(extras.length, 0, 'não documentadas: ' + extras.join(', '))
})
teste('perfis da tabela são da v2 (Dependente/Adulto/Administrador), nunca "Júnior"', () => {
  for (const [nome, def] of Object.entries(acoes)) assert.ok(def.perfil === null || ['Dependente', 'Adulto', 'Administrador'].includes(def.perfil), nome + ': ' + def.perfil)
  assert.equal(acoes.painel.perfil, 'Adulto'); assert.equal(acoes.salvar_patrimonio.perfil, 'Administrador'); assert.equal(acoes.assistente.perfil, 'Dependente')
})
teste('dados iniciais: 4 tipos, 14 grupos, 53 categorias, 8 grupos de análise, 68 versículos', () => {
  assert.equal(g.dadosIniciaisTipos().length, 4); assert.equal(g.dadosIniciaisGrupos().length, 14); assert.equal(g.dadosIniciaisCategorias().length, 53)
  assert.equal(g.dadosIniciaisGruposAnalise().length, 8); assert.equal(g.dadosIniciaisVersiculos().length, 68)
  assert.equal(g.dadosIniciaisCores().indigo, '#5B5BE0')
  const cat = g.dadosIniciaisCategorias().find((c) => c.id === 'c_mercado')
  assert.equal(cat.tipo_id, 't_variaveis'); assert.equal(cat.icone, 'shopping-cart'); assert.equal(cat.grupo_analise, 'Alimentação')
  assert.equal(g.dadosIniciaisCategorias().find((c) => c.id === 'c_aporte_projeto').oculta_cardapio, true)
  assert.equal(g.dadosIniciaisGrupos()[0].nome, 'Dízimo e ofertas')
})

console.log('12) Esquema das abas (v2)')
const ORDEM = vm.runInContext('ORDEM_ABAS', ctx), ESQ = vm.runInContext('ESQUEMA', ctx)
teste('esquema cobre todas as 25 abas', () => { assert.equal(ORDEM.length, 25); for (const aba of ORDEM) assert.ok(ESQ[aba], aba) })
teste('abas novas: Tipos, RegrasLoja, Alertas, Patrimonio, Avisos, Conversas, Telegram', () => { for (const aba of ['Tipos', 'RegrasLoja', 'Alertas', 'Patrimonio', 'Avisos', 'Conversas', 'Telegram']) assert.ok(ORDEM.includes(aba) && ESQ[aba].colunas.length > 2, aba) })
teste('Grupos e Categorias com as colunas da v2', () => {
  assert.equal(JSON.stringify(ESQ.Grupos.colunas), JSON.stringify(['id', 'tipo_id', 'nome', 'cor', 'grupo_analise', 'ordem', 'ativo']))
  assert.equal(JSON.stringify(ESQ.Categorias.colunas), JSON.stringify(['id', 'tipo_id', 'grupo_id', 'nome', 'icone', 'cor', 'tipo', 'fixa', 'orcamento_mensal', 'palavras_chave', 'grupo_analise', 'sensivel', 'oculta_cardapio', 'ativa']))
  assert.ok(ESQ.Alertas.listas.includes('avisar')); assert.ok(ESQ.Telegram.colunas.includes('chat_id'))
})
teste('Config padrão tem as chaves da v2', () => {
  const c = g.configPadrao('Reis')
  assert.equal(c.dependente_ve_salarios, false); assert.equal(c.rotina_vigia, true); assert.equal(c.rotina_quinzenal, true); assert.equal(c.rotina_fechamento, true); assert.equal(c.telegram_ativo, false)
  assert.equal(c.junior_ve_salarios, undefined)
})
teste('normalizarPerfil: Júnior → Dependente', () => { assert.equal(g.normalizarPerfil('Júnior'), 'Dependente'); assert.equal(g.normalizarPerfil('junior'), 'Dependente'); assert.equal(g.normalizarPerfil('Adulto'), 'Adulto'); assert.equal(g.normalizarPerfil(''), 'Adulto') })
teste('ehDespesaReal: aporte em projeto não é despesa', () => {
  const cats = g.dadosIniciaisCategorias()
  assert.equal(g.ehDespesaReal(cats.find((c) => c.id === 'c_aporte_projeto')), false)
  assert.equal(g.ehDespesaReal(cats.find((c) => c.id === 'c_mercado')), true)
  assert.equal(g.ehDespesaReal(cats.find((c) => c.id === 'c_salario')), false)
  assert.equal(g.ehDespesaReal({ id: 'c_aporte_sonho', tipo: 'despesa' }), false)
})
teste('VERSAO_API 2.0.0', () => assert.equal(vm.runInContext('VERSAO_API', ctx), '2.0.0'))

// ---------- Banco sintético para as regras da v2 ----------
const hoje = g.hojeIso(), comp = g.competenciaDe()
const m = (k) => g.somarMeses(comp, -k)
function bancoTeste() {
  const tipos = g.dadosIniciaisTipos(), grupos = g.dadosIniciaisGrupos(), categorias = g.dadosIniciaisCategorias()
  const lancamentos = []
  let n = 0
  const add = (o) => lancamentos.push(Object.assign({ id: 'l' + (++n), status: 'confirmado', excluido: false, forma_pgto: 'pix', usuario_id: 'u_luiz', estabelecimento: '', descricao: '', cartao_id: '', parcela: '' }, o, { competencia: o.competencia || o.data.slice(0, 7) }))
  for (let k = 11; k >= 0; k--) {
    const c = m(k)
    add({ data: c + '-05', tipo: 'receita', valor: 9000, categoria_id: 'c_salario', descricao: 'Salário' })
    add({ data: c + '-10', tipo: 'despesa', valor: 1000, categoria_id: 'c_mercado', estabelecimento: 'Supermercado Condor', descricao: 'Condor', forma_pgto: 'débito' })
    add({ data: c + '-09', tipo: 'despesa', valor: 55.9, categoria_id: 'c_streaming', estabelecimento: 'NETFLIX.COM', descricao: 'Netflix', forma_pgto: 'crédito', cartao_id: 'k1' })
    add({ data: c + '-06', tipo: 'despesa', valor: 800, categoria_id: 'c_aporte_projeto', estabelecimento: 'Poupança', descricao: 'Aporte: Viagem de julho', projeto_id: 'p_viagem' })
    if (k >= 1 && k <= 3) add({ data: c + '-15', tipo: 'despesa', valor: 100, categoria_id: 'c_delivery', estabelecimento: 'iFood', descricao: 'iFood', forma_pgto: 'crédito', cartao_id: 'k1' })
  }
  // Mês atual: delivery fora do padrão (300 contra média 100), cobrança duplicada, assinatura nova.
  add({ data: comp + '-02', tipo: 'despesa', valor: 300, categoria_id: 'c_delivery', estabelecimento: 'IFOOD', descricao: 'iFood', forma_pgto: 'crédito', cartao_id: 'k1' })
  add({ data: comp + '-03', tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', estabelecimento: 'DROGARIA NISSEI', descricao: 'Drogaria Nissei', forma_pgto: 'crédito', cartao_id: 'k2', usuario_id: 'u_nina' })
  add({ data: comp + '-03', tipo: 'despesa', valor: 64.9, categoria_id: 'c_farmacia', estabelecimento: 'DROGARIA NISSEI', descricao: 'Drogaria Nissei', forma_pgto: 'crédito', cartao_id: 'k2', usuario_id: 'u_nina' })
  add({ data: comp + '-01', tipo: 'despesa', valor: 44.9, categoria_id: 'c_streaming', estabelecimento: 'DISNEY PLUS', descricao: 'Disney', forma_pgto: 'crédito', cartao_id: 'k1' })
  add({ data: m(1) + '-13', tipo: 'despesa', valor: 44.9, categoria_id: 'c_streaming', estabelecimento: 'DISNEY PLUS', descricao: 'Disney', forma_pgto: 'crédito', cartao_id: 'k1' })
  // Parcela futura de cartão (a confirmar) no mês que vem.
  add({ data: m(3) + '-16', competencia: g.somarMeses(comp, 1), tipo: 'despesa', valor: 189.9, categoria_id: 'c_moveis', estabelecimento: 'Tok&Stok', descricao: 'Sofá da sala', forma_pgto: 'crédito', cartao_id: 'k2', parcela: '5/10', status: 'a_confirmar', usuario_id: 'u_nina' })
  const venc2 = g.somarDias(hoje, 2), venc10 = g.somarDias(hoje, 10), atrasada = g.somarDias(hoje, -5)
  const aportes = lancamentos.filter((l) => l.projeto_id).map((l, i) => ({ id: 'a' + i, projeto_id: l.projeto_id, data: l.data, valor: l.valor, usuario_id: l.usuario_id, observacao: '' }))
  return {
    config: { nome_familia: 'Família Reis', dependente_ve_salarios: false, regra_votacao: 'maioria_mais_pais' },
    usuarios: [
      { id: 'u_luiz', apelido: 'Luiz', perfil: 'Administrador', ativo: true }, { id: 'u_nina', apelido: 'Nina', perfil: 'Administrador', ativo: true },
      { id: 'u_julia', apelido: 'Júlia', perfil: 'Dependente', ativo: true }, { id: 'u_pedro', apelido: 'Pedro', perfil: 'Júnior', ativo: true },
    ],
    tipos, grupos, categorias, regras_loja: [], lancamentos,
    contas_fixas: [
      { id: 'f_luz', nome: 'Luz — Copel', categoria_id: 'c_luz', valor_previsto: 412, dia_vencimento: Number(venc2.slice(8, 10)), ativa: true },
      { id: 'f_agua', nome: 'Água — Sanepar', categoria_id: 'c_agua', valor_previsto: 168, dia_vencimento: Number(venc10.slice(8, 10)), ativa: true },
    ],
    contas_a_pagar: [
      { id: 'cp1', conta_fixa_id: 'f_luz', competencia: venc2.slice(0, 7), valor: 412, vencimento: venc2, status: 'aberta', linha_digitavel: '8364 0000' },
      { id: 'cp0', conta_fixa_id: 'f_luz', competencia: atrasada.slice(0, 7) === venc2.slice(0, 7) ? m(1) : atrasada.slice(0, 7), valor: 398, vencimento: atrasada, status: 'aberta' },
    ],
    cartoes: [{ id: 'k1', apelido: 'Itaú', final: '4821', titular_id: 'u_luiz', dia_fechamento: 28, dia_vencimento: 5, ativo: true }, { id: 'k2', apelido: 'Nubank', final: '0937', titular_id: 'u_nina', dia_fechamento: 20, dia_vencimento: 10, ativo: true }],
    caixa_entrada: [{ id: 'ce1', status: 'pendente', valor: 87.4, estabelecimento: 'PADARIA PAO QUENTE', usuario_id: 'u_luiz' }],
    orcamento: [{ competencia: comp, categoria_id: 'c_delivery', valor_planejado: 300 }, { competencia: comp, categoria_id: 'c_mercado', valor_planejado: 1200 }, { competencia: comp, categoria_id: 'c_aporte_projeto', valor_planejado: 500 }],
    projetos: [
      { id: 'p_viagem', nome: 'Viagem de julho', meta_valor: 18000, data_alvo: g.somarMeses(comp, 12) + '-01', valor_inicial: 240, prioridade: 1, status: 'ativo', criado_por: 'u_nina' },
      { id: 'p_carro', nome: 'Troca do carro', meta_valor: 45000, data_alvo: g.somarMeses(comp, 24) + '-01', valor_inicial: 2800, prioridade: 3, status: 'votação', criado_por: 'u_luiz' },
    ],
    aportes,
    decisoes: [{ id: 'd_carro', titulo: 'Trocar o carro', status: 'aberta', projeto_id: 'p_carro', prazo: g.somarMeses(comp, 1) + '-05' }],
    votos: [{ decisao_id: 'd_carro', usuario_id: 'u_luiz', voto: 'sim' }, { decisao_id: 'd_carro', usuario_id: 'u_julia', voto: 'sim' }],
    alertas: [
      { id: 'al_1', nome: 'Delivery acima de R$ 200/mês', tipo: 'categoria_acima', categoria_id: 'c_delivery', limite: 200, avisar: ['u_luiz', 'u_nina'], ativo: true },
      { id: 'al_2', nome: 'Nova assinatura detectada', tipo: 'nova_assinatura', limite: 0, avisar: [], ativo: true },
      { id: 'al_3', nome: 'Mercado acima de R$ 5.000', tipo: 'categoria_acima', categoria_id: 'c_mercado', limite: 5000, avisar: [], ativo: true },
    ],
    avisos: [{ id: 'av_semcat', lido: true }],
  }
}
const visaoAdmin = { ver_sensivel: true, uid: 'u_luiz', dependente: false }
const visaoDep = { ver_sensivel: false, uid: 'u_julia', dependente: true }

console.log('13) Resumo do mês e painel')
teste('resumo: aporte não conta como despesa; por_tipo e projetos preenchidos', () => {
  const r = g.calcularResumoMes(bancoTeste(), visaoAdmin, m(1))
  assert.equal(r.entrou, 9000)
  assert.equal(r.saiu, 1200.8) // mercado 1000 + netflix 55,90 + delivery 100 + disney 44,90 (aporte de 800 fica fora)
  assert.equal(r.por_tipo.t_fixas.realizado, 100.8); assert.equal(r.por_tipo.t_variaveis.realizado, 1100)
  assert.equal(r.por_tipo.t_receitas.orcado, 9000) // receita do mês anterior
  assert.equal(r.por_tipo.t_projetos.realizado, r.projetos.guardado_total)
  assert.equal(r.projetos.ativos, 1); assert.ok(r.projetos.guardado_total > 240 + 800 * 11)
  assert.equal(r.por_grupo.g_alimentacao.realizado, 1100)
})
teste('resumo: orçamento soma por tipo e por grupo', () => {
  const r = g.calcularResumoMes(bancoTeste(), visaoAdmin, comp)
  assert.equal(r.por_tipo.t_variaveis.orcado, 1500); assert.equal(r.por_grupo.g_alimentacao.orcado, 1500); assert.equal(r.por_categoria.c_delivery.orcado, 300)
  assert.equal(r.por_usuario.u_nina, 129.8)
})
teste('resumo: receita prevista usa o Orçamento quando há salário planejado; senão, o mês anterior', () => {
  const semPlano = g.calcularResumoMes(bancoTeste(), visaoAdmin, comp)
  assert.equal(semPlano.por_tipo.t_receitas.orcado, 9000)
  const d = bancoTeste()
  d.orcamento.push({ competencia: comp, categoria_id: 'c_salario', valor_planejado: 12000 }, { competencia: comp, categoria_id: 'c_renda_extra', valor_planejado: 500 })
  assert.equal(g.calcularResumoMes(d, visaoAdmin, comp).por_tipo.t_receitas.orcado, 12500)
})
teste('resumo: Dependente sem dependente_ve_salarios não vê salários', () => { assert.equal(g.calcularResumoMes(bancoTeste(), visaoDep, m(1)).entrou, 0) })
teste('painel: meses futuros previstos (média 3 meses; dezembro ×1,5; despesas = orçamento sem aportes)', () => {
  const ano = Number(comp.slice(0, 4)) + 1
  const p = g.calcularPainel(bancoTeste(), visaoAdmin, ano, '', hoje)
  assert.equal(p.ano, ano); assert.equal(p.meses.length, 12)
  assert.ok(p.meses.every((x) => x.previsto === true))
  assert.equal(p.meses[0].salarios, 9000); assert.equal(p.meses[11].salarios, 13500)
  assert.equal(p.meses[0].despesas, 1500); assert.equal(p.meses[0].por_tipo.t_variaveis, 1500); assert.equal(p.meses[0].por_grupo_analise['Alimentação'], 1500)
  assert.equal(p.meses[0].saldo, 9000 - 1500)
})
teste('painel: mês realizado traz por_tipo, por_grupo_analise e por_categoria', () => {
  const ano = Number(comp.slice(0, 4))
  const p = g.calcularPainel(bancoTeste(), visaoAdmin, ano, '', hoje)
  const mes = p.meses.find((x) => x.competencia === comp)
  assert.equal(mes.previsto, false); assert.equal(mes.por_categoria.c_delivery, 300); assert.equal(mes.por_grupo_analise['Alimentação'], 1300)
  assert.equal(mes.por_tipo.t_variaveis, 1300 + 129.8); assert.equal(mes.por_categoria.c_aporte_projeto, undefined)
  assert.ok(p.poupanca_projetos.length === 12 && p.poupanca_projetos[11].total > 0)
  assert.equal(p.orcado_por_categoria.c_mercado, 1200)
})

console.log('14) Projetos calculados')
teste('comProjetoCalculado: no ritmo, necessário/mês, votos', () => {
  const d = bancoTeste()
  const pc = g.comProjetoCalculado(d, d.projetos[0], hoje)
  assert.equal(pc.valor_atual, 240 + 800 * 12); assert.equal(pc.media_3m, 800)
  assert.equal(pc.necessario_mes, Math.round((18000 - pc.valor_atual) / 12)); assert.equal(pc.situacao, 'no_ritmo'); assert.equal(pc.atraso, 0)
  const pv = g.comProjetoCalculado(d, d.projetos[1], hoje)
  assert.equal(pv.situacao, 'votacao'); assert.equal(pv.votos_sim, 2); assert.equal(pv.votos_total, 2); assert.equal(pv.aguardando, 2)
})
teste('projetarMeta com corte mensal', () => {
  const d = bancoTeste()
  const pm = g.projetarMeta(d, d.projetos[0], 130, hoje)
  assert.equal(pm.ritmo_considerado, 930); assert.equal(pm.falta, 18000 - 9840); assert.equal(pm.meses_no_ritmo, Math.ceil(8160 / 930)); assert.equal(pm.no_prazo, true)
})

console.log('15) Próximas saídas, vigia e alertas')
teste('proximas_saidas: conta lida do e-mail, estimada e parcela de cartão', () => {
  const d = bancoTeste()
  const s = g.calcularProximasSaidas(d, 60, hoje)
  assert.ok(s.some((x) => x.id === 'cp1' && x.status === 'lida_do_email' && x.titulo === 'Luz — Copel'))
  assert.ok(s.some((x) => x.status === 'estimada' && x.titulo === 'Água — Sanepar' && x.valor === 168))
  const parc = s.find((x) => x.status === 'parcela')
  assert.ok(parc && /parcela 5\/10/.test(parc.titulo) && parc.valor === 189.9 && parc.data === g.somarMeses(comp, 1) + '-10')
  assert.ok(s.some((x) => x.status === 'parcial' && /Cartão/.test(x.titulo)))
  assert.ok(!s.some((x) => x.id === 'cp0'), 'atrasada não entra nas próximas saídas')
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].data <= s[i].data, 'ordenado por data')
  assert.ok(!g.calcularProximasSaidas(d, 30, hoje).some((x) => x.status === 'estimada' && x.data > g.somarDias(hoje, 30)))
})
teste('vigia: gasto fora do padrão (>1,35× média de 3 meses)', () => {
  const av = g.gerarAvisos(bancoTeste(), hoje)
  const fora = av.find((a) => a.id === 'av_fora_c_delivery')
  assert.ok(fora, 'aviso de delivery'); assert.equal(fora.tipo, 'fora_do_padrao'); assert.match(fora.titulo, /^Delivery 200% acima da média/); assert.match(fora.detalhe, /R\$ 300,00/); assert.equal(fora.gravidade, 'red')
  assert.ok(!av.some((a) => a.id === 'av_fora_c_mercado'), 'mercado estável não gera aviso')
})
teste('vigia: cobrança duplicada no cartão', () => {
  const dup = g.gerarAvisos(bancoTeste(), hoje).find((a) => a.tipo === 'cobranca_duplicada')
  assert.ok(dup); assert.match(dup.detalhe, /DROGARIA NISSEI R\$ 64,90 duas vezes/); assert.equal(dup.gravidade, 'warn')
})
teste('vigia: assinatura nova (Disney) e não a antiga (Netflix)', () => {
  const av = g.gerarAvisos(bancoTeste(), hoje)
  assert.ok(av.some((a) => a.id === 'av_ass_DISNEY PLUS' && /DISNEY PLUS R\$ 44,90 desde/.test(a.detalhe)))
  assert.ok(!av.some((a) => a.id === 'av_ass_NETFLIX COM'))
  const ass = g.detectarAssinaturas(bancoTeste(), hoje)
  assert.equal(ass.find((a) => a.loja === 'NETFLIX COM').nova, false); assert.equal(ass.find((a) => a.loja === 'DISNEY PLUS').nova, true)
})
teste('vigia: vencimento em 2 dias, atrasada, sem categoria (lido) e alerta personalizado', () => {
  const av = g.gerarAvisos(bancoTeste(), hoje)
  const venc = av.find((a) => a.id === 'av_venc_cp1'); assert.ok(venc); assert.match(venc.titulo, /vence em 2 dias/); assert.match(venc.detalhe, /código de barras/)
  const atr = av.find((a) => a.id === 'av_atr_cp0'); assert.ok(atr); assert.match(atr.titulo, /venceu há 5 dias/); assert.equal(atr.gravidade, 'red')
  const sem = av.find((a) => a.id === 'av_semcat'); assert.ok(sem); assert.equal(sem.lido, true); assert.match(sem.titulo, /^1 gasto do cartão sem categoria/)
  const al = av.find((a) => a.id === 'av_al_al_1'); assert.ok(al); assert.equal(al.tipo, 'alerta_personalizado'); assert.match(al.detalhe, /R\$ 300,00 no mês \(limite R\$ 200,00\)/); assert.equal(JSON.stringify(al.avisar), JSON.stringify(['u_luiz', 'u_nina']))
  assert.ok(av.some((a) => a.id === 'av_al_al_2'), 'alerta de nova assinatura dispara')
  assert.ok(!av.some((a) => a.id === 'av_al_al_3'), 'alerta abaixo do limite não dispara')
})
teste('alertasCalculados: status e percentual', () => {
  const als = g.alertasCalculados(bancoTeste(), hoje)
  assert.equal(als[0].status_atual, 'disparado'); assert.equal(als[0].percentual_atual, 150); assert.equal(als[1].status_atual, 'disparado'); assert.equal(als[2].status_atual, 'ok'); assert.equal(als[2].percentual_atual, 20)
})
teste('destinatários: alerta → avisar; demais → administradores', () => {
  const d = bancoTeste()
  assert.equal(JSON.stringify(g.destinatariosDoAviso({ tipo: 'alerta_personalizado', avisar: ['u_nina'] }, d.usuarios)), JSON.stringify(['u_nina']))
  assert.equal(JSON.stringify(g.destinatariosDoAviso({ tipo: 'alerta_personalizado', avisar: [] }, d.usuarios)), JSON.stringify(['u_luiz', 'u_nina']))
  assert.equal(JSON.stringify(g.destinatariosDoAviso({ tipo: 'vencimento' }, d.usuarios)), JSON.stringify(['u_luiz', 'u_nina']))
})
teste('analisarTendencias: delivery sobe e há recomendação objetiva', () => {
  const t = g.analisarTendencias(bancoTeste(), hoje)
  assert.equal(t.subiram[0].categoria_id, 'c_delivery'); assert.ok(t.subiram[0].variacao >= 50); assert.match(t.recomendacao, /^Delivery caminha para R\$ [\d.,]+ no mês, \d+% acima da média de R\$ [\d.,]+\. Voltar à média liberaria cerca de R\$/)
})
teste('markdownParaHtml', () => { assert.equal(g.markdownParaHtml('# T\n- a **b**\n> c'), '<h1>T</h1>\n<ul>\n<li>a <b>b</b></li>\n</ul>\n<blockquote>c</blockquote>') })

console.log('16) Regras de loja')
teste('regraDaLoja casa por conteúdo e prefere a chave mais longa', () => {
  const regras = [{ loja_normalizada: 'IFOOD', categoria_id: 'c_delivery' }, { loja_normalizada: 'IFOOD MERCADO', categoria_id: 'c_mercado' }]
  assert.equal(g.regraDaLoja('IFOOD *PIZZARIA', regras).categoria_id, 'c_delivery')
  assert.equal(g.regraDaLoja('iFood Mercado Express', regras).categoria_id, 'c_mercado')
  assert.equal(g.regraDaLoja('PADARIA', regras), null); assert.equal(g.regraDaLoja('', regras), null)
})
teste('aplicarRegraLoja põe a categoria aprendida em 1º lugar (máx. 6)', () => {
  const s = g.aplicarRegraLoja('POSTO SHELL', ['c_combustivel', 'c_app_transporte', 'c_mercado', 'c_padaria', 'c_delivery', 'c_farmacia'], [{ loja_normalizada: 'POSTO SHELL', categoria_id: 'c_manutencao_carro' }])
  assert.equal(s[0], 'c_manutencao_carro'); assert.equal(s.length, 6); assert.equal(s[1], 'c_combustivel')
  assert.equal(JSON.stringify(g.aplicarRegraLoja('X', ['c_mercado'], [])), JSON.stringify(['c_mercado']))
})
teste('responderLocal aplica a regra da loja ao lançar por texto', () => {
  const d = bancoTeste(); d.regras_loja = [{ loja_normalizada: 'PADARIA', categoria_id: 'c_restaurantes' }]
  const r = g.responderLocal(d, visaoAdmin, 'u_luiz', 'gastei 30 na padaria', hoje)
  assert.equal(r.lancamento.categoria_id, 'c_restaurantes')
})

console.log('17) Assistente (regras locais, sem chave)')
teste('1. "Quanto gastamos com delivery este mês?"', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Quanto gastamos com delivery este mês?', hoje)
  assert.match(r.texto, /\*\*R\$ 300,00\*\* em 1 lançamento de Delivery — 200% acima da média dos últimos 3 meses \(R\$ 100,00\)/)
  assert.equal(r.barras.length, 2); assert.equal(r.barras[0].valor, 300); assert.equal(r.barras[1].valor, 100); assert.equal(r.barras[1].rotulo, 'Média 3 meses')
})
teste('2. "Quais assinaturas temos?"', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Quais assinaturas temos?', hoje)
  assert.match(r.texto, /Temos 2 assinaturas este mês, somando \*\*R\$ 100,80\*\*/); assert.match(r.texto, /Netflix \(R\$ 55,90\)/); assert.equal(r.barras.length, 2); assert.equal(r.barras[0].cor, 'rose')
})
teste('3. "Contas que vencem esta semana"', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Contas que vencem esta semana', hoje)
  assert.match(r.texto, /Luz — Copel \(R\$ 412,00, dia \d{2}\)/); assert.match(r.texto, /Total \*\*R\$/)
})
teste('4. "Como fechamos <mês passado>?"', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Como fechamos ' + g.nomeMes(m(1)) + '?', hoje)
  assert.ok(r.texto.startsWith(g.nomeCompetencia(m(1)) + ': entrou **R$ 9.000,00**, saiu **R$ 1.200,80** e sobrou **R$ 7.799,20**'), r.texto)
  assert.match(r.texto, /Despesas fixas R\$ 100,80 e variáveis R\$ 1.100,00/); assert.equal(r.barras[0].rotulo, 'Receitas'); assert.equal(r.barras[1].valor, 1200.8)
})
teste('5. "gastei 45 na padaria no pix" lança', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'gastei 45 na padaria no pix', hoje)
  assert.equal(r.etiqueta, 'lançado'); assert.equal(r.lancamento.valor, 45); assert.equal(r.lancamento.categoria_id, 'c_padaria'); assert.equal(r.lancamento.forma_pgto, 'pix'); assert.equal(r.lancamento.usuario_id, 'u_luiz'); assert.equal(r.lancamento.origem, 'chat')
  assert.match(r.texto, /^Lancei \*\*R\$ 45,00 · Padaria\*\* \(Despesas variáveis › Alimentação\), hoje, Pix, por Luiz\./)
  assert.match(g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'gastei na padaria', hoje).texto, /Não entendi o valor/)
})
teste('encontrarCategoriaNoTexto respeita fronteira de palavra', () => {
  const cats = g.dadosIniciaisCategorias()
  assert.equal(g.encontrarCategoriaNoTexto('QUANTO GASTAMOS COM DELIVERY ESTE MES', cats).id, 'c_delivery')
  assert.equal(g.encontrarCategoriaNoTexto('QUANTO GASTAMOS DE GAS', cats).id, 'c_gas')
  assert.equal(g.encontrarCategoriaNoTexto('QUANTO GASTAMOS NO POSTO SHELL', cats).id, 'c_combustivel')
  assert.equal(g.encontrarCategoriaNoTexto('BOM DIA', cats), null)
})
teste('6. "Onde podemos economizar?" e 7. projeto', () => {
  const r = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Onde podemos economizar?', hoje)
  assert.match(r.texto, /\*\*Delivery\*\* \(R\$ 300,00 contra R\$ 100,00\)/); assert.ok(r.barras.length >= 1)
  const p = g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'Dá para fechar a viagem de julho?', hoje)
  assert.match(p.texto, /No ritmo atual \(R\$ 800,00\/mês\) o projeto \*\*Viagem de julho\*\* chega a 100% da meta/); assert.match(p.texto, /Faltam R\$ 8\.160,00/)
  assert.match(g.responderLocal(bancoTeste(), visaoAdmin, 'u_luiz', 'bom dia', hoje).texto, /Posso responder sobre gastos por categoria/)
})
teste('Dependente não vê salários no fechamento', () => { assert.match(g.responderLocal(bancoTeste(), visaoDep, 'u_julia', 'como fechamos ' + g.nomeMes(m(1)) + '?', hoje).texto, /entrou \*\*R\$ 0,00\*\*/) })
teste('sugestões contextuais', () => {
  const s = g.sugestoesAssistente(bancoTeste(), visaoAdmin, hoje)
  assert.ok(s.length >= 5 && s.length <= 6); assert.equal(s[0], 'Quanto gastamos com delivery este mês?'); assert.ok(s.includes('Quais assinaturas temos?')); assert.ok(s.includes('Contas que vencem esta semana')); assert.ok(s.some((x) => /Viagem de julho/.test(x)))
})
teste('resumo agregado: sem dados pessoais além do apelido', () => {
  const r = g.montarResumoAgregado(bancoTeste(), visaoAdmin, hoje)
  assert.equal(r.meses.length, 12); assert.equal(r.membros[0].apelido, 'Luiz'); assert.equal(Object.keys(r.membros[0]).sort().join(','), 'apelido,id,perfil')
  assert.equal(r.medias_3m_por_categoria.c_delivery, 100); assert.ok(r.projetos[0].necessario_mes > 0); assert.ok(r.assinaturas.length >= 2)
  assert.ok(!JSON.stringify(r).includes('token') && !JSON.stringify(r).includes('pin_'))
})
teste('ferramentas do Claude: 5 definidas com input_schema', () => {
  const f = g.ferramentasAssistente()
  assert.equal(f.map((x) => x.name).join(','), 'buscar_lancamentos,total_por_categoria,projetar_meta,lancar_despesa,proximas_saidas')
  for (const x of f) assert.equal(x.input_schema.type, 'object')
})
teste('extrairBarras tira a linha JSON final', () => {
  const r = g.extrairBarras('Em outubro foram R$ 300,00 contra R$ 100,00 de média.\n{"barras":[{"rotulo":"Outubro","valor":300,"cor":"magenta"},{"rotulo":"Média","valor":100,"cor":"indigo"},{"rotulo":"x","valor":"abc"}]}')
  assert.equal(r.texto, 'Em outubro foram R$ 300,00 contra R$ 100,00 de média.'); assert.equal(r.barras.length, 2); assert.equal(r.barras[0].cor, 'magenta')
  assert.equal(g.extrairBarras('Só texto.').barras, undefined); assert.equal(g.extrairBarras('Texto\n{"barras": "nada"}').texto, 'Texto\n{"barras": "nada"}')
})
teste('historicoParaMensagens alterna papéis e começa pelo usuário', () => {
  const h = g.historicoParaMensagens([{ papel: 'assistente', texto: 'oi' }, { papel: 'eu', texto: 'a' }, { papel: 'eu', texto: 'b' }, { papel: 'assistente', texto: 'c' }])
  assert.equal(JSON.stringify(h), JSON.stringify([{ role: 'user', content: 'a\nb' }, { role: 'assistant', content: 'c' }]))
})

console.log('18) Telegram')
teste('parsearComandoStart', () => {
  assert.equal(g.parsearComandoStart('/start 123456'), '123456'); assert.equal(g.parsearComandoStart('/start@FamiliaBot 654321'), '654321'); assert.equal(g.parsearComandoStart('/START=111222'), '111222')
  assert.equal(g.parsearComandoStart('/start'), ''); assert.equal(g.parsearComandoStart('/start 12'), ''); assert.equal(g.parsearComandoStart('gastei 45 na padaria'), null); assert.equal(g.parsearComandoStart('/startar 123456'), null)
})
teste('textoParaTelegram converte **negrito** e tira crases', () => assert.equal(g.textoParaTelegram('Lancei **R$ 45,00** `x`'), "Lancei *R$ 45,00* 'x'"))
teste('cardapioParaPrompt lista id, nome, grupo e ícone sem itens ocultos', () => {
  const t = g.cardapioParaPrompt(g.dadosIniciaisCategorias(), g.dadosIniciaisGrupos())
  assert.match(t, /- c_mercado: Supermercado \(Alimentação, shopping-cart\)/); assert.ok(!t.includes('c_aporte_projeto'))
})

console.log('19) Primeira execução no Google: parâmetros HTTP, gatilhos, migração e resumo')
teste('extrairParametros: JSON em text/plain junta com a URL', () => {
  const p = g.extrairParametros({ parameter: { webhook: '1' }, postData: { type: 'text/plain', contents: ' {"acao":"ping","token":"t"} ' } }, 'POST')
  assert.equal(p.webhook, '1'); assert.equal(p.acao, 'ping'); assert.equal(p.token, 't')
})
teste('extrairParametros: corpo de formulário (x-www-form-urlencoded) usa e.parameter sem erro', () => {
  const p = g.extrairParametros({ parameter: { webhook: '1', texto: 'Compra aprovada', token: 'x' }, postData: { type: 'application/x-www-form-urlencoded', contents: 'webhook=1&texto=Compra+aprovada&token=x' } }, 'POST')
  assert.equal(p.texto, 'Compra aprovada'); assert.equal(p.webhook, '1')
})
teste('extrairParametros: JSON quebrado ou corpo sem sentido dá ErroUsuario em português', () => {
  const ErroUsuario = vm.runInContext('ErroUsuario', ctx) // class é lexical: não vira propriedade do contexto
  assert.throws(() => g.extrairParametros({ parameter: {}, postData: { contents: '{"acao":' } }, 'POST'), (e) => e instanceof ErroUsuario && /JSON/.test(e.message))
  assert.throws(() => g.extrairParametros({ parameter: {}, postData: { contents: 'lixo' } }, 'POST'), (e) => e instanceof ErroUsuario)
  assert.equal(g.extrairParametros({ parameter: { acao: 'ping' } }, 'GET').acao, 'ping')
})
teste('horaDe: "00:30" é meia-noite, não o padrão', () => { assert.equal(g.horaDe('00:30'), 0); assert.equal(g.horaDe('20:00'), 20); assert.equal(g.horaDe(''), 20); assert.equal(g.horaDe('abc', 7), 7); assert.equal(g.horaDe('25:00'), 23) })
teste('calcularResumoMes não derruba com categoria sem grupo_id', () => {
  const d = bancoTeste()
  d.categorias = d.categorias.map((c) => (c.id === 'c_delivery' ? { ...c, grupo_id: '' } : c))
  d.orcamento.push({ competencia: comp, categoria_id: 'c_delivery', valor_planejado: 100 })
  const r = g.calcularResumoMes(d, visaoAdmin, comp)
  assert.ok(r.saiu > 0); assert.equal(r.por_categoria.c_delivery.realizado, 300); assert.equal(r.por_grupo[''], undefined)
})
teste('normalizar remove acentos combinados (classe \\u0300-\\u036f)', () => { assert.equal(g.normalizar('São João — Açúcar'), 'SAO JOAO ACUCAR'); assert.equal(g.hashDedup(10, '2026-01-02', '', 'São João'), g.hashDedup(10, '2026-01-02', '', 'SAO JOAO')) })
teste('threadsNaoProcessadas filtra pelo marcador "Processado" sem usar GmailApp.search', () => {
  const rot = (nome) => ({ getName: () => nome })
  const thread = (labels) => ({ getLabels: () => labels.map(rot) })
  const t1 = thread(['Contas da Casa']), t2 = thread(['Contas da Casa', 'Processado']), t3 = thread([])
  const marcador = { getThreads: (ini, max) => { assert.equal(ini, 0); assert.ok(max >= 20); return [t1, t2, t3] } }
  assert.deepEqual(g.threadsNaoProcessadas(marcador, rot('Processado')), [t1, t3])
})
teste('TAMANHO_PEDACO_CACHE cabe em 100 KB mesmo com acentos (2 bytes por caractere)', () => assert.ok(vm.runInContext('TAMANHO_PEDACO_CACHE', ctx) * 2 <= 100 * 1024))
teste('CSV de exportação começa com BOM escapado (\\uFEFF)', () => assert.ok(fs.readFileSync(path.join(raiz, 'lancamentos.gs'), 'utf8').includes("'\\uFEFF' +")))

console.log(`\n${total - falhas}/${total} testes passaram${falhas ? ` — ${falhas} FALHA(S)` : ''}`)
process.exit(falhas ? 1 : 0)
