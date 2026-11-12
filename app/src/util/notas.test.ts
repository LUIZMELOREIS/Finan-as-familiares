import { describe, expect, it } from 'vitest'
import { lojaDeFraseSemValor } from './notas'

describe('lojaDeFraseSemValor', () => {
  it('extrai a loja de "comprei no Condor"', () => {
    expect(lojaDeFraseSemValor('Comprei no Condor')).toBe('Condor')
    expect(lojaDeFraseSemValor('eu comprei hoje na Nissei, pedi CPF')).toBe('Nissei')
    expect(lojaDeFraseSemValor('passei na Leroy Merlin agora')).toBe('Leroy Merlin')
  })
  it('devolve vazio quando há valor ou não é frase de compra', () => {
    expect(lojaDeFraseSemValor('gastei 45 na padaria no pix')).toBe('')
    expect(lojaDeFraseSemValor('Quanto gastamos com delivery?')).toBe('')
    expect(lojaDeFraseSemValor('comprei')).toBe('')
  })
})
