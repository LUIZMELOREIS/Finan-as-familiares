/**
 * Robô de notas fiscais — regras puras compartilhadas entre Lançar › Falar, o
 * Assistente e o modo demonstração (mesma expressão de apps-script/notasFiscais.gs).
 */
import { extrairValor } from './extrator'

/** "comprei no Condor" / "passei na Nissei hoje" sem valor → "Condor"; '' quando a frase tem valor ou não é de compra. */
export function lojaDeFraseSemValor(texto: string): string {
  const t = texto.trim()
  if (!t || (extrairValor(t) ?? 0) > 0) return ''
  const m = t.match(/^(?:eu\s+)?(?:comprei|gastei|paguei|passei|fiz\s+compra)\s+(?:hoje|ontem|agora|de\s+manh[aã]|à\s+tarde|à\s+noite)?\s*(?:no|na|em|do|da|nos|nas)\s+(.+?)(?:[,;]?\s+(?:hoje|ontem|agora|com\s+cpf|na\s+nota|pedi\s+cpf).*)?[.!?,;]*$/i)
  if (!m) return ''
  const loja = m[1].replace(/\b(cpf|nota|cart[aã]o|cr[eé]dito|d[eé]bito|pix|dinheiro)\b.*$/i, '').replace(/[,.;!?]+$/, '').trim().replace(/(?:\s+(?:no|na|em|com|de|do|da|nos|nas))+$/i, '').trim()
  return loja.length >= 3 ? loja : ''
}
