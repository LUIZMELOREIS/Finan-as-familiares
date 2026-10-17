import { describe, it, expect } from 'vitest'
import jsQR from 'jsqr'
import { gerarQr, capacidadeBytes, qrSvg, type MatrizQr } from './qr'

/** Desenha a matriz como imagem RGBA (escala 4 px, margem 4 módulos) para o decodificador independente. */
function rasterizar(m: MatrizQr, escala = 4, margem = 4) {
  const lado = (m.tamanho + margem * 2) * escala
  const dados = new Uint8ClampedArray(lado * lado * 4).fill(255)
  for (let l = 0; l < m.tamanho; l++) for (let c = 0; c < m.tamanho; c++) {
    if (!m.modulos[l][c]) continue
    for (let dy = 0; dy < escala; dy++) for (let dx = 0; dx < escala; dx++) {
      const x = (c + margem) * escala + dx
      const y = (l + margem) * escala + dy
      const i = (y * lado + x) * 4
      dados[i] = dados[i + 1] = dados[i + 2] = 0
    }
  }
  return { dados, lado }
}

const LOCALIZADOR = [
  '1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111',
]
function bloco(m: MatrizQr, l0: number, c0: number) {
  return LOCALIZADOR.map((_, dl) => m.modulos[l0 + dl].slice(c0, c0 + 7).map((v) => (v ? '1' : '0')).join(''))
}

describe('gerador de QR Code', () => {
  it('escolhe a versão pelo tamanho do texto e gera a matriz com o tamanho certo', () => {
    expect(gerarQr('OLA').tamanho).toBe(21) // versão 1
    const convite = gerarQr('https://familia.exemplo.com.br/#/entrar?convite=ABC123')
    expect(convite.versao).toBe(4)
    expect(convite.tamanho).toBe(33)
    expect(capacidadeBytes(1)).toBe(14)
    expect(capacidadeBytes(10)).toBe(213)
    expect(gerarQr('x'.repeat(213)).versao).toBe(10)
    expect(() => gerarQr('x'.repeat(214))).toThrow()
  })

  it('tem os três padrões localizadores e a temporização', () => {
    for (const texto of ['OLA', 'https://familia.exemplo.com.br/#/entrar?convite=ABC123&perfil=Adulto', 'y'.repeat(200)]) {
      const m = gerarQr(texto)
      const n = m.tamanho
      expect(bloco(m, 0, 0)).toEqual(LOCALIZADOR)
      expect(bloco(m, 0, n - 7)).toEqual(LOCALIZADOR)
      expect(bloco(m, n - 7, 0)).toEqual(LOCALIZADOR)
      for (let i = 8; i < n - 8; i++) {
        expect(m.modulos[6][i]).toBe(i % 2 === 0)
        expect(m.modulos[i][6]).toBe(i % 2 === 0)
      }
      expect(m.modulos[n - 8][8]).toBe(true) // módulo escuro fixo
    }
  })

  it('é lido de volta por um decodificador independente (jsQR) em várias versões', () => {
    const textos = [
      'OLA',
      'https://familia.exemplo.com.br/#/entrar?convite=ABC123&perfil=Adulto',
      'Convite da Família Reis — acentos e símbolos: ç ã é R$ 1.234,56 / ' + 'abc'.repeat(20),
      'z'.repeat(150),
      'w'.repeat(213),
    ]
    for (const texto of textos) {
      const m = gerarQr(texto)
      const { dados, lado } = rasterizar(m)
      const lido = jsQR(dados, lado, lado)
      expect(lido, `versão ${m.versao}`).not.toBeNull()
      expect(lido?.data).toBe(texto)
    }
  })

  it('gera um SVG com o caminho dos módulos', () => {
    const svg = qrSvg('https://exemplo.com.br/#/entrar?convite=XYZ789')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path d="M')
    expect(svg).toContain('viewBox="0 0 41 41"') // 33 + 2 × 4 de margem
  })
})
