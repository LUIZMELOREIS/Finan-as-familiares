import { describe, it, expect } from 'vitest'
import { linkWhatsApp, mensagemConvite, mensagemOutroAparelho, telefoneParaWhatsApp } from './convidar'

describe('telefoneParaWhatsApp', () => {
  it('normaliza números brasileiros', () => {
    expect(telefoneParaWhatsApp('(41) 99999-1234')).toBe('5541999991234')
    expect(telefoneParaWhatsApp('41 3333-1234')).toBe('554133331234')
    expect(telefoneParaWhatsApp('+55 41 99999-1234')).toBe('5541999991234')
    expect(telefoneParaWhatsApp('')).toBe('')
  })
})

describe('linkWhatsApp', () => {
  it('sem telefone deixa o WhatsApp escolher o contato; com telefone abre a conversa', () => {
    expect(linkWhatsApp('oi')).toBe('https://wa.me/?text=oi')
    expect(linkWhatsApp('oi & tchau', '41 99999-1234')).toBe('https://wa.me/5541999991234?text=oi%20%26%20tchau')
  })
})

describe('mensagemConvite', () => {
  it('traz o nome, os 3 passos, o link e a validade', () => {
    const m = mensagemConvite({ nome: 'Nina', url: 'https://x.y/?c=abc', nomeFamilia: 'Família Reis', validade: '29/10/2026', quemConvida: 'Luiz' })
    expect(m.startsWith('Oi, Nina!')).toBe(true)
    expect(m).toContain('1) ')
    expect(m).toContain('3) ')
    expect(/\p{Extended_Pictographic}/u.test(m)).toBe(false) // o wa.me estraga emojis
    expect(m).toContain('https://x.y/?c=abc')
    expect(m).toContain('vale até 29/10/2026')
    expect(m).toContain('(Luiz)')
    expect(m).toContain('da Família Reis')
  })
  it('sem nome fica genérica', () => {
    const m = mensagemConvite({ url: 'u' })
    expect(m.startsWith('Oi!')).toBe(true)
    expect(m).toContain('da nossa família')
    expect(m).not.toContain('vale até')
  })
})

describe('mensagemOutroAparelho', () => {
  it('termina com o link', () => { expect(mensagemOutroAparelho('https://z').endsWith('https://z')).toBe(true) })
})
