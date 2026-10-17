import { describe, it, expect } from 'vitest'
import { gerarBrasaoSvg, OPCOES_PADRAO, SIMBOLOS, FORMATOS, DIVISOES, escaparXml } from './gerador'

/** Verificação "válido-ish" de XML: toda tag aberta é fechada na ordem certa. */
function tagsBalanceadas(xml: string): boolean {
  const pilha: string[] = []
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const [, fecha, nome, , autoFecha] = m
    if (autoFecha) continue
    if (fecha) {
      if (pilha.pop() !== nome) return false
    } else pilha.push(nome)
  }
  return pilha.length === 0
}

describe('gerador de brasão', () => {
  it('contém as iniciais, o mote e o ano', () => {
    const svg = gerarBrasaoSvg({ ...OPCOES_PADRAO, iniciais: 'mr', mote: 'Soli Deo Gloria', ano: '2008' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('>MR<')
    expect(svg).toContain('Soli Deo Gloria')
    expect(svg).toContain('>2008<')
  })

  it('gera XML balanceado para todos os formatos, divisões e símbolos', () => {
    for (const f of FORMATOS) for (const d of DIVISOES) for (const s of SIMBOLOS) {
      const svg = gerarBrasaoSvg({ ...OPCOES_PADRAO, formato: f.id, divisao: d.id, simbolo: s.id })
      expect(tagsBalanceadas(svg), `${f.id}/${d.id}/${s.id}`).toBe(true)
      expect(svg).not.toContain('undefined')
      expect(svg).not.toContain('NaN')
    }
  })

  it('escapa caracteres especiais do mote', () => {
    const svg = gerarBrasaoSvg({ ...OPCOES_PADRAO, mote: 'Fé & "Família" <3' })
    expect(svg).toContain('Fé &amp; &quot;Família&quot; &lt;3')
    expect(tagsBalanceadas(svg)).toBe(true)
    expect(escaparXml("'")).toBe('&apos;')
  })

  it('usa a segunda cor só quando há divisão', () => {
    const liso = gerarBrasaoSvg({ ...OPCOES_PADRAO, divisao: 'liso', cor2: '#123456' })
    const partido = gerarBrasaoSvg({ ...OPCOES_PADRAO, divisao: 'partido', cor2: '#123456' })
    expect(liso).not.toContain('#123456')
    expect(partido).toContain('#123456')
  })
})
