import { describe, it, expect } from 'vitest'
import { moeda, lerValor, dataBr, dataIso, nomeCompetencia, somarMeses, hashDedup, normalizar, moedaCurta } from './formato'

describe('formato brasileiro', () => {
  it('formata moeda em R$ 1.234,56', () => {
    expect(moeda(1234.56).replace(/ /g, ' ')).toBe('R$ 1.234,56')
    expect(moeda(0).replace(/ /g, ' ')).toBe('R$ 0,00')
  })
  it('lê valores digitados de várias formas', () => {
    expect(lerValor('1.234,56')).toBe(1234.56)
    expect(lerValor('1234.56')).toBe(1234.56)
    expect(lerValor('R$ 45')).toBe(45)
    expect(lerValor('45,9')).toBe(45.9)
    expect(lerValor('')).toBe(0)
  })
  it('converte datas', () => {
    expect(dataBr('2026-03-05')).toBe('05/03/2026')
    expect(dataIso('5/3/2026')).toBe('2026-03-05')
    expect(dataIso('05/03/26')).toBe('2026-03-05')
  })
  it('nomeia competências e soma meses', () => {
    expect(nomeCompetencia('2026-03')).toBe('Março de 2026')
    expect(nomeCompetencia('2026-03', true)).toBe('Mar/26')
    expect(somarMeses('2026-11', 3)).toBe('2027-02')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
  })
  it('deduplica a mesma compra vinda de canais diferentes', () => {
    const a = hashDedup(87.4, '2026-03-05', '1234', 'PADARIA PÃO QUENTE LTDA')
    const b = hashDedup(87.4, '2026-03-05T14:00:00', '1234', 'padaria pao quente ltda')
    expect(a).toBe(b)
    expect(hashDedup(87.41, '2026-03-05', '1234', 'PADARIA')).not.toBe(a)
  })
  it('normaliza texto', () => {
    expect(normalizar('Açaí & Cia.')).toBe('ACAI CIA')
  })
  it('moeda curta', () => {
    expect(moedaCurta(12500)).toContain('mil')
  })
})
