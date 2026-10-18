/**
 * Extração "offline" de informações de texto:
 *  - frase ditada ("gastei 45 reais na padaria no pix");
 *  - SMS/alerta de banco ("Compra aprovada ... R$ 87,40 em PADARIA ... final 4321").
 * No servidor, o Apps Script usa a mesma lógica (regex por banco) antes de chamar o Claude.
 * Também sugere categorias pelas palavras-chave cadastradas.
 */
import type { Categoria, FormaPgto, LeituraExtraida } from '../tipos'
import { hojeIso, normalizar } from './formato'

/** Sugere até 6 categorias para um texto, pelas palavras-chave (e pelo nome da categoria). */
export function sugerirCategoria(texto: string, categorias: Categoria[], tipo: 'despesa' | 'receita' = 'despesa'): string[] {
  const t = normalizar(texto)
  // Termos curtos (até 4 letras) só casam palavra inteira: "GAS" não pode casar em "GASTEI".
  const contem = (termo: string) => (termo.length >= 5 ? t.includes(termo) : new RegExp(`(^|\\s)${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(t))
  const pontuadas: Array<{ id: string; pontos: number }> = []
  for (const c of categorias) {
    if (c.tipo !== tipo || c.ativa === false) continue
    let pontos = 0
    for (const pc of (c.palavras_chave || '').split(';').map((s) => normalizar(s)).filter(Boolean)) {
      if (contem(pc)) pontos += pc.length >= 5 ? 3 : 2
    }
    if (contem(normalizar(c.nome))) pontos += 2
    const primeiraPalavra = normalizar(c.nome).split(' ')[0]
    if (primeiraPalavra.length > 3 && contem(primeiraPalavra)) pontos += 1
    if (pontos) pontuadas.push({ id: c.id, pontos })
  }
  pontuadas.sort((a, b) => b.pontos - a.pontos)
  const ids = pontuadas.map((p) => p.id)
  // Completa com as categorias mais comuns do dia a dia.
  const padrao = ['c_mercado', 'c_padaria', 'c_delivery', 'c_farmacia', 'c_combustivel', 'c_passeios', 'c_imprevistos']
  for (const p of padrao) if (ids.length < 6 && !ids.includes(p) && categorias.some((c) => c.id === p)) ids.push(p)
  return ids.slice(0, 6)
}

const NUMEROS_POR_EXTENSO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000,
}

/** Lê um valor em reais de uma frase: "45 reais", "R$ 45,90", "quarenta e cinco reais", "45 e 50". */
export function extrairValor(texto: string): number | undefined {
  const t = texto.toLowerCase()
  // R$ 1.234,56 | 45,90 | 45.90 | 45 reais | 45 reais e 50 centavos
  const m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[,.]\d{1,2}|\d+)(?:\s*(?:reais|real|conto|pila|pau)?(?:\s*e\s*(\d{1,2})\s*(?:centavos)?)?)/)
  if (m && (t.includes('r$') || /reais|real|conto|pila|pau|centavos|gastei|paguei|custou|foi|deu|de\s+\d/.test(t) || /\d[,.]\d{2}/.test(m[1]))) {
    let v = m[1]
    if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.')
    let n = parseFloat(v)
    if (m[2] && !m[1].includes(',') && !m[1].includes('.')) n += parseInt(m[2], 10) / 100
    if (!isNaN(n)) return Math.round(n * 100) / 100
  }
  // Por extenso simples: "quarenta e cinco reais", "cento e vinte"
  const palavras = t.replace(/[^a-zà-ú\s]/g, ' ').split(/\s+/)
  let total = 0
  let achou = false
  let acumulado = 0
  for (const p of palavras) {
    if (p in NUMEROS_POR_EXTENSO) {
      const n = NUMEROS_POR_EXTENSO[p]
      if (n === 1000) { acumulado = (acumulado || 1) * 1000; total += acumulado; acumulado = 0 }
      else acumulado += n
      achou = true
    } else if (p !== 'e' && achou) {
      total += acumulado
      acumulado = 0
      if (/reais|real|conto|pila/.test(p)) break
    }
  }
  total += acumulado
  return achou && total > 0 ? total : undefined
}

export function extrairFormaPgto(texto: string): FormaPgto | undefined {
  const t = normalizar(texto)
  if (/\bPIX\b/.test(t)) return 'pix'
  if (/DEBITO/.test(t)) return 'débito'
  if (/CREDITO|CARTAO|PARCEL/.test(t)) return 'crédito'
  if (/DINHEIRO|ESPECIE/.test(t)) return 'dinheiro'
  if (/BOLETO/.test(t)) return 'boleto'
  return undefined
}

/** Data relativa: hoje, ontem, anteontem, "dia 12", "12/03". */
export function extrairData(texto: string): string {
  const t = normalizar(texto)
  const hoje = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (/ANTEONTEM/.test(t)) return iso(new Date(hoje.getTime() - 2 * 86_400_000))
  if (/ONTEM/.test(t)) return iso(new Date(hoje.getTime() - 86_400_000))
  const m = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear()
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  const d = t.match(/\bDIA (\d{1,2})\b/)
  if (d) return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${d[1].padStart(2, '0')}`
  return hojeIso()
}

/** Padrões de SMS/alerta por banco. Fácil de ampliar: basta acrescentar uma linha. */
export const PADROES_BANCO: Array<{ banco: string; regex: RegExp; grupos: { valor: number; estabelecimento: number; final?: number; parcelas?: number } }> = [
  // Itaú: "Compra aprovada no seu Itaú final 4321: R$ 87,40 em PADARIA PAO QUENTE em 17/10 às 08:12"
  { banco: 'Itaú', regex: /ITA[UÚ].*?final\s*(\d{4}).*?R\$\s*([\d.]+,\d{2})\s*(?:em|no|na)\s+(.+?)(?:\s+em\s+\d{1,2}\/\d{1,2}|\s+[aà]s\s+\d|,|\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Nubank: "Compra de R$ 156,90 APROVADA em DROGARIA NISSEI com o cartão final 8765"
  { banco: 'Nubank', regex: /Compra\s+de\s+R\$\s*([\d.]+,\d{2})\s+APROVADA\s+em\s+(.+?)\s+(?:com|no)\b.*?final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Bradesco: "BRADESCO CARTOES: COMPRA APROVADA NO CARTAO FINAL 1234 EM 17/10 10:00 NO VALOR DE R$ 50,00 EM MERCADO X"
  { banco: 'Bradesco', regex: /BRADESCO.*?FINAL\s*(\d{4}).*?VALOR\s+DE\s+R\$\s*([\d.]+,\d{2})\s+EM\s+(.+?)(?:\.|$)/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Santander: "Santander: compra aprovada cartao final 1234 R$ 50,00 MERCADO X 17/10 10:00"
  { banco: 'Santander', regex: /SANTANDER.*?final\s*(\d{4})\s*R\$\s*([\d.]+,\d{2})\s+(.+?)\s+\d{1,2}\/\d{1,2}/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Banco do Brasil: "BB: Compra aprovada R$ 50,00 em MERCADO X cartao final 1234 17/10 10:00"
  { banco: 'Banco do Brasil', regex: /\bBB\b.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // Caixa: "CAIXA: Compra aprovada no cartao final 1234, R$ 50,00, MERCADO X, 17/10"
  { banco: 'Caixa', regex: /CAIXA.*?final\s*(\d{4}),?\s*R\$\s*([\d.]+,\d{2}),?\s*(.+?),/i, grupos: { final: 1, valor: 2, estabelecimento: 3 } },
  // Inter: "Inter: compra aprovada de R$ 50,00 em MERCADO X no cartao final 1234"
  { banco: 'Inter', regex: /INTER.*?R\$\s*([\d.]+,\d{2})\s+em\s+(.+?)\s+no\s+cart[aã]o\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // C6: "C6 Bank: Compra aprovada R$ 50,00 MERCADO X final 1234"
  { banco: 'C6', regex: /C6.*?R\$\s*([\d.]+,\d{2})\s+(.+?)\s+final\s*(\d{4})/i, grupos: { valor: 1, estabelecimento: 2, final: 3 } },
  // BV / Ailos / cooperativas e genérico: "... R$ 50,00 ... em MERCADO X ... final 1234"
  { banco: 'Genérico', regex: /R\$\s*([\d.]+,\d{2})\s+(?:em|no|na|-)\s+(.+?)(?:\s+(?:com|no|cart[aã]o|final|em\s+\d|as\s+\d|,|\.|$))/i, grupos: { valor: 1, estabelecimento: 2 } },
]

const IGNORAR_SMS = /c[oó]digo|senha|token|verifica[cç][aã]o|OTP|n[aã]o compartilhe|promo[cç][aã]o|oferta especial|desconto|cashback|clique|acesse|fatura fechada|pagamento recebido|limite dispon/i

/** Resultado da leitura de um SMS/alerta. */
export interface LeituraSms {
  valido: boolean
  motivo?: string
  banco?: string
  valor?: number
  estabelecimento?: string
  final_cartao?: string
  parcelas?: string
  data?: string
}

export function lerSms(texto: string): LeituraSms {
  if (!texto || texto.length < 10) return { valido: false, motivo: 'Mensagem vazia' }
  if (IGNORAR_SMS.test(texto) && !/compra/i.test(texto)) return { valido: false, motivo: 'Não é uma compra (código, promoção ou aviso)' }
  if (/estorno|cancelad/i.test(texto)) return { valido: false, motivo: 'Estorno/cancelamento — ignorado' }
  for (const padrao of PADROES_BANCO) {
    const m = texto.match(padrao.regex)
    if (!m) continue
    const valor = parseFloat(m[padrao.grupos.valor].replace(/\./g, '').replace(',', '.'))
    const estabelecimento = m[padrao.grupos.estabelecimento].trim().replace(/\s+/g, ' ')
    const final_cartao = padrao.grupos.final ? m[padrao.grupos.final] : texto.match(/final\s*(\d{4})/i)?.[1] || ''
    const parc = texto.match(/(\d{1,2})\s*[xX]\b|em\s+(\d{1,2})\s*(?:vezes|parcelas)/)
    const parcelas = parc ? `1/${parc[1] || parc[2]}` : undefined
    if (!valor || !estabelecimento) continue
    return { valido: true, banco: padrao.banco, valor, estabelecimento, final_cartao, parcelas, data: extrairData(texto) }
  }
  return { valido: false, motivo: 'Não reconhecemos o formato deste banco' }
}

/** Frase ditada → lançamento. */
export function extrairDeTexto(texto: string, categorias: Categoria[]): LeituraExtraida {
  const sms = lerSms(texto)
  if (sms.valido) {
    const sug = sugerirCategoria(sms.estabelecimento || '', categorias)
    return { valor: sms.valor, data: sms.data, estabelecimento: sms.estabelecimento, descricao: sms.estabelecimento, forma_pgto: 'crédito', categoria_id: sug[0], confianca: 0.8, origem_leitura: 'regex' }
  }
  const valor = extrairValor(texto)
  const ehReceita = /recebi|entrou|ganhei|salario|salário|pagaram/i.test(texto)
  const sug = sugerirCategoria(texto, categorias, ehReceita ? 'receita' : 'despesa')
  // Descrição: tira os números e as palavras de ligação.
  let descricao = texto
    .replace(/r\$\s*[\d.,]+|\b\d+[.,]?\d*\s*(reais|real|conto|pila|centavos)?\b/gi, ' ')
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|no pix|pix|d[ée]bito|cr[ée]dito|dinheiro|boleto|cart[aã]o|hoje|ontem|anteontem|de|da|do|na|no|em|com|e|um|uma|o|a)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (descricao) descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1)
  return {
    valor, data: extrairData(texto), descricao: descricao || undefined, estabelecimento: descricao || undefined,
    forma_pgto: extrairFormaPgto(texto), categoria_id: sug[0],
    confianca: valor ? 0.7 : 0.3, origem_leitura: 'regex',
  }
}
