import { describe, expect, it } from 'vitest'
import { codificarConvite, decodificarConvite } from './convite'

describe('convite compacto', () => {
  it('codifica e decodifica sem perder nada, inclusive acentos', () => {
    const d = { convite: 'HUEE7U', perfil: 'Administrador', api: 'https://script.google.com/macros/s/X/exec', familia: 'tok&1=ç' }
    const c = codificarConvite(d)
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodificarConvite(c)).toEqual({ ...d, demo: undefined })
  })
  it('aceita base64url com padding e rejeita lixo', () => {
    const c = codificarConvite({ convite: 'ABC234' })
    expect(decodificarConvite(c + '==')?.convite).toBe('ABC234')
    expect(decodificarConvite('nao-e-base64')).toBeNull()
    expect(decodificarConvite('')).toBeNull()
    expect(decodificarConvite(btoa('{"x":1}'))).toBeNull()
  })
})
