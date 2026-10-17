import { describe, it, expect } from 'vitest'
import { converterInline, converterMarkdown, markdownParaTexto, secaoVazia, textoDaSecao } from './markdown'

const PAUTA = [
  '# Reunião da família — Setembro de 2026', '',
  '## 1. Como fechou o mês',
  '- Entrou **R$ 16.300,00** · Saiu R$ 14.120,00 · Sobrou R$ 2.180,00',
  '- Mês anterior: sobrou R$ 900,00',
  '', '## 2. O que passou do orçamento', '- Nada passou do orçamento.',
  '', '## 6. Para refletir', '> "Sem conselho os projetos saem vãos." — Provérbios 15:22',
  '', '## 7. O que decidimos', '_(preencher)_',
  '', '## 8. Motivo de gratidão', 'Pela saúde de todos.',
].join('\n')

describe('mini-conversor de markdown', () => {
  it('separa títulos de nível 1 e 2 com número', () => {
    const s = converterMarkdown(PAUTA)
    expect(s[0]).toMatchObject({ nivel: 1, titulo: 'Reunião da família — Setembro de 2026', numero: undefined })
    expect(s[1]).toMatchObject({ nivel: 2, titulo: 'Como fechou o mês', numero: 1 })
    expect(s.map((x) => x.numero)).toEqual([undefined, 1, 2, 6, 7, 8])
  })
  it('reconhece itens, citações e parágrafos', () => {
    const s = converterMarkdown(PAUTA)
    expect(s[1].blocos.map((b) => b.tipo)).toEqual(['item', 'item'])
    expect(s[3].blocos[0].tipo).toBe('citacao')
    expect(s[5].blocos[0]).toEqual({ tipo: 'paragrafo', trechos: [{ texto: 'Pela saúde de todos.' }] })
  })
  it('converte negrito e itálico', () => {
    expect(converterInline('Entrou **R$ 16.300,00** hoje')).toEqual([{ texto: 'Entrou ' }, { texto: 'R$ 16.300,00', negrito: true }, { texto: ' hoje' }])
    expect(converterInline('_(preencher)_')).toEqual([{ texto: '(preencher)', italico: true }])
    expect(converterInline('snake_case_nome fica inteiro')).toEqual([{ texto: 'snake_case_nome fica inteiro' }])
    expect(converterInline('')).toEqual([{ texto: '' }])
  })
  it('detecta seção por preencher', () => {
    const s = converterMarkdown(PAUTA)
    expect(secaoVazia(s[4])).toBe(true)
    expect(secaoVazia(s[5])).toBe(false)
    expect(secaoVazia({ nivel: 2, titulo: 'x', blocos: [] })).toBe(true)
  })
  it('vira texto simples para compartilhar', () => {
    const s = converterMarkdown(PAUTA)
    expect(textoDaSecao(s[1])).toBe('• Entrou R$ 16.300,00 · Saiu R$ 14.120,00 · Sobrou R$ 2.180,00\n• Mês anterior: sobrou R$ 900,00')
    expect(markdownParaTexto('## 2. Teste\n- a\n> b')).toBe('2. TESTE\n• a\n“b”')
  })
  it('texto solto antes de qualquer título vira seção sem título', () => {
    const s = converterMarkdown('Olá\n- item')
    expect(s).toHaveLength(1)
    expect(s[0].titulo).toBe('')
    expect(s[0].blocos).toHaveLength(2)
  })
})
