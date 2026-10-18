import { describe, it, expect } from 'vitest'
import dados from '../../../dados/grupos_categorias.json'
import type { Categoria } from '../tipos'
import { extrairValor, lerSms, extrairDeTexto, sugerirCategoria, extrairFormaPgto } from './extrator'

const categorias = dados.categorias as Categoria[]

describe('extração de valor', () => {
  it('lê valores em várias formas', () => {
    expect(extrairValor('gastei 45 reais na padaria')).toBe(45)
    expect(extrairValor('R$ 1.234,56 no mercado')).toBe(1234.56)
    expect(extrairValor('paguei 45,90 de farmácia')).toBe(45.9)
    expect(extrairValor('quarenta e cinco reais de gasolina')).toBe(45)
    expect(extrairValor('cento e vinte reais')).toBe(120)
    expect(extrairValor('mil e duzentos de aluguel')).toBe(1200)
  })
})

describe('leitura de SMS de banco', () => {
  it('Itaú', () => {
    const r = lerSms('Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12.')
    expect(r.valido).toBe(true)
    expect(r.valor).toBe(87.4)
    expect(r.estabelecimento).toBe('PADARIA PAO QUENTE')
    expect(r.final_cartao).toBe('4321')
  })
  it('Nubank', () => {
    const r = lerSms('Nubank: Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765.')
    expect(r.valido).toBe(true)
    expect(r.valor).toBe(156.9)
    expect(r.estabelecimento).toBe('DROGARIA NISSEI')
    expect(r.final_cartao).toBe('8765')
  })
  it('Bradesco', () => {
    const r = lerSms('BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 17/10 10:00 NO VALOR DE R$ 50,00 EM MERCADO CONDOR.')
    expect(r.valido).toBe(true)
    expect(r.valor).toBe(50)
    expect(r.estabelecimento).toBe('MERCADO CONDOR')
  })
  it('ignora códigos de verificação e propaganda', () => {
    expect(lerSms('Seu código de verificação é 123456. Não compartilhe.').valido).toBe(false)
    expect(lerSms('Promoção imperdível! Clique e ganhe desconto.').valido).toBe(false)
    expect(lerSms('Estorno de R$ 50,00 em LOJA X final 1234').valido).toBe(false)
  })
  it('detecta parcelas', () => {
    const r = lerSms('Compra aprovada no seu Itaú final 4321: R$ 600,00 em LOJAS RENNER em 3x em 17/10.')
    expect(r.valido).toBe(true)
    expect(r.parcelas).toBe('1/3')
  })
})

describe('frase ditada', () => {
  it('gastei 45 reais na padaria no pix', () => {
    const r = extrairDeTexto('gastei 45 reais na padaria no pix', categorias)
    expect(r.valor).toBe(45)
    expect(r.forma_pgto).toBe('pix')
    expect(r.categoria_id).toBe('c_padaria')
  })
  it('sugere categoria por palavra-chave', () => {
    expect(sugerirCategoria('POSTO SHELL', categorias)[0]).toBe('c_combustivel')
    expect(sugerirCategoria('DROGARIA NISSEI', categorias)[0]).toBe('c_farmacia')
    expect(sugerirCategoria('NETFLIX.COM', categorias)[0]).toBe('c_streaming')
  })
  it('forma de pagamento', () => {
    expect(extrairFormaPgto('no débito')).toBe('débito')
    expect(extrairFormaPgto('parcelado em 3x')).toBe('crédito')
  })
})
