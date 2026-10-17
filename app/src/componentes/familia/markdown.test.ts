import { describe, it, expect } from 'vitest'
import { analisarInline, analisarMarkdown, dividirSecoes, markdownParaTexto, iconeDaSecao, formatarNumerosBr } from './markdown'

const PAUTA = [
  '# Reunião da Família — 2026-10',
  '',
  '## 1. Como fechou o mês',
  '- Entrou: R$ 10.000,00 · Saiu: R$ 8.000,00 ✅',
  '- Mês anterior sobrou: R$ 500,00',
  '',
  '## 6. Para refletir',
  '> "Sem conselho os projetos saem vãos" — Provérbios 15:22',
  '',
  '## 7. O que decidimos',
  '_(preencher)_',
  'Segunda linha do **mesmo** parágrafo.',
].join('\n')

describe('mini-conversor de markdown', () => {
  it('separa negrito e itálico', () => {
    expect(analisarInline('a **b** c _d_')).toEqual([
      { tipo: 'texto', texto: 'a ' },
      { tipo: 'negrito', texto: 'b' },
      { tipo: 'texto', texto: ' c ' },
      { tipo: 'italico', texto: 'd' },
    ])
    expect(analisarInline('sem marcação')).toEqual([{ tipo: 'texto', texto: 'sem marcação' }])
  })
  it('reconhece títulos, listas, citações e parágrafos', () => {
    const blocos = analisarMarkdown(PAUTA)
    expect(blocos.map((b) => b.tipo)).toEqual(['h1', 'h2', 'item', 'item', 'h2', 'citacao', 'h2', 'paragrafo'])
    const ultimo = blocos[blocos.length - 1]
    expect(ultimo.trechos).toEqual([
      { tipo: 'italico', texto: '(preencher)' },
      { tipo: 'texto', texto: ' Segunda linha do ' },
      { tipo: 'negrito', texto: 'mesmo' },
      { tipo: 'texto', texto: ' parágrafo.' },
    ])
  })
  it('divide em seções por ##, com o título geral do #', () => {
    const { titulo, secoes } = dividirSecoes(PAUTA)
    expect(titulo).toBe('Reunião da Família — 2026-10')
    expect(secoes.map((s) => s.titulo)).toEqual(['1. Como fechou o mês', '6. Para refletir', '7. O que decidimos'])
    expect(secoes[0].blocos).toHaveLength(2)
    expect(secoes[1].blocos[0].tipo).toBe('citacao')
  })
  it('conteúdo antes do primeiro ## vira uma seção sem título', () => {
    const { secoes } = dividirSecoes('# T\n\nIntrodução\n\n## A\n- x')
    expect(secoes[0].titulo).toBe('')
    expect(secoes[0].blocos[0].tipo).toBe('paragrafo')
    expect(secoes[1].titulo).toBe('A')
  })
  it('gera texto puro para compartilhar', () => {
    const texto = markdownParaTexto(PAUTA)
    expect(texto.startsWith('REUNIÃO DA FAMÍLIA — 2026-10')).toBe(true)
    expect(texto).toContain('• Entrou: R$ 10.000,00')
    expect(texto).toContain('(preencher) Segunda linha do mesmo parágrafo.')
    expect(texto).not.toContain('**')
    expect(texto).not.toContain('## ')
  })
  it('escolhe o ícone pela numeração da seção', () => {
    expect(iconeDaSecao('1. Como fechou o mês')).toBe('📈')
    expect(iconeDaSecao('8. Motivo de oração e gratidão')).toBe('🙏')
    expect(iconeDaSecao('Outra coisa')).toBe('📝')
  })
  it('formata números com duas casas no padrão brasileiro', () => {
    expect(formatarNumerosBr('Entrou: R$ 16053.01 · Saiu: R$ 850.5 ✅')).toBe('Entrou: R$ 16.053,01 · Saiu: R$ 850.5 ✅')
    expect(formatarNumerosBr('Padaria: 207.27 de 200.00 planejados')).toBe('Padaria: 207,27 de 200,00 planejados')
    expect(formatarNumerosBr('prazo 2026-11-05 · 93% · Lucas 14:28')).toBe('prazo 2026-11-05 · 93% · Lucas 14:28')
  })
})
