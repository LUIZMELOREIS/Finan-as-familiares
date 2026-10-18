import { describe, it, expect } from 'vitest'
import { gerarBrasaoSvg, escapar, pathsMovel, FORMATOS, PARTICOES, MOVEIS, OURO, type OpcoesBrasao } from './gerador'

/** Verifica se as tags XML abrem e fecham na ordem certa (sem DOMParser no Node). */
function xmlBalanceado(xml: string): boolean {
  const pilha: string[] = []
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g
  let m: RegExpExecArray | null
  let ultimo = 0
  while ((m = re.exec(xml))) {
    if (m.index !== ultimo && /[<>]/.test(xml.slice(ultimo, m.index))) return false
    ultimo = re.lastIndex
    const [, fecha, nome, , autoFecha] = m
    if (autoFecha) continue
    if (fecha) { if (pilha.pop() !== nome) return false } else pilha.push(nome)
  }
  return pilha.length === 0 && ultimo === xml.length
}

describe('gerador do brasão', () => {
  it('gera um SVG 512×512 em traço dourado com iniciais e mote', () => {
    const svg = gerarBrasaoSvg({ iniciais: 'lr', mote: 'Soli Deo Gloria', movel: 'cruz', ano: '2012' })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"')).toBe(true)
    expect(svg).toContain('>LR</text>')
    expect(svg).toContain('>Soli Deo Gloria</text>')
    expect(svg).toContain('>2012</text>')
    expect(svg).toContain(`stroke="${OURO}"`)
    // o ouro é traço nas formas (não chapado); só as letras têm preenchimento dourado
    expect(svg).not.toMatch(/<(path|rect|circle)[^>]*fill="#F2C552"/)
    expect(xmlBalanceado(svg)).toBe(true)
  })

  it('escapa caracteres especiais do texto', () => {
    expect(escapar(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;')
    const svg = gerarBrasaoSvg({ iniciais: '<&', mote: 'Fé & "Trabalho"' })
    expect(svg).toContain('&lt;&amp;')
    expect(svg).toContain('Fé &amp; &quot;Trabalho&quot;')
    expect(svg).not.toContain('<&')
    expect(xmlBalanceado(svg)).toBe(true)
  })

  it('produz XML balanceado em todas as combinações de escudo, partição, móvel, fundo e iniciais', () => {
    let combinacoes = 0
    for (const { id: escudo } of FORMATOS) for (const { id: particao } of PARTICOES) for (const { id: movel } of MOVEIS) {
      for (const fundo of ['circulo', 'quadrado'] as const) for (const iniciais of ['', 'A', 'LNR']) for (const mote of ['', 'Josué 24.15']) {
        const o: Partial<OpcoesBrasao> = { escudo, particao, movel, fundo, iniciais, mote }
        const svg = gerarBrasaoSvg(o)
        expect(xmlBalanceado(svg), JSON.stringify(o)).toBe(true)
        expect(svg).toContain('<clipPath id="escudo">')
        if (iniciais) expect(svg).toContain(`>${iniciais}</text>`)
        if (movel !== 'nenhum') expect(pathsMovel(movel).length).toBeGreaterThan(0)
        combinacoes++
      }
    }
    expect(combinacoes).toBe(3 * 5 * 7 * 2 * 3 * 2)
  })

  it('limita as iniciais a 3 letras maiúsculas e respeita a espessura do traço', () => {
    const svg = gerarBrasaoSvg({ iniciais: 'abcdef', traco: 8, movel: 'nenhum' })
    expect(svg).toContain('>ABC</text>')
    expect(svg).toContain('stroke-width="8"')
    expect(gerarBrasaoSvg({ mote: '' })).not.toContain('M124 386')
  })
})
