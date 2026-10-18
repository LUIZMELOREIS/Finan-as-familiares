/** Utilitários de formatação em português do Brasil. */

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** R$ 1.234,56 */
export function moeda(valor: number | undefined | null): string {
  return fmtMoeda.format(valor ?? 0)
}

/** 1.234,56 (sem o R$) */
export function numero(valor: number | undefined | null): string {
  return fmtNumero.format(valor ?? 0)
}

/** R$ 1,2 mil / R$ 12 mil — para espaços pequenos (sparklines, anéis). */
export function moedaCurta(valor: number): string {
  const abs = Math.abs(valor)
  const sinal = valor < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return moeda(valor)
}

/** Converte "1.234,56" ou "1234.56" ou "45" em número. */
export function lerValor(texto: string): number {
  if (!texto) return 0
  let t = texto.replace(/[^\d,.-]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

/** ISO (aaaa-mm-dd) → dd/mm/aaaa */
export function dataBr(iso: string | undefined | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  if (!a || !m || !d) return iso
  return `${d}/${m}/${a}`
}

/** dd/mm/aaaa → ISO */
export function dataIso(br: string): string {
  const m = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return br
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function agoraIso(): string {
  return new Date().toISOString()
}

/** AAAA-MM de uma data ISO (ou de hoje). */
export function competenciaDe(iso?: string): string {
  const d = iso ? iso.slice(0, 7) : hojeIso().slice(0, 7)
  return d
}

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2026-03" → "Março de 2026" */
export function nomeCompetencia(comp: string, curto = false): string {
  const [a, m] = comp.split('-').map(Number)
  if (!a || !m) return comp
  return curto ? `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}` : `${MESES[m - 1]} de ${a}`
}

/** Soma n meses a uma competência AAAA-MM. */
export function somarMeses(comp: string, n: number): string {
  const [a, m] = comp.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Meses inteiros entre hoje e uma data ISO (mínimo 0). */
export function mesesAte(iso: string): number {
  const hoje = new Date()
  const alvo = new Date(iso)
  const meses = (alvo.getFullYear() - hoje.getFullYear()) * 12 + (alvo.getMonth() - hoje.getMonth())
  return Math.max(0, meses)
}

export function porcentagem(parte: number, total: number): number {
  if (!total) return 0
  return Math.round((parte / total) * 1000) / 10
}

/** Normaliza texto para comparação: sem acento, maiúsculo, sem espaços duplos. */
export function normalizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Hash simples e determinístico (djb2) para deduplicação. */
export function hashTexto(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** hash_dedup = valor + data + final_cartao + estabelecimento normalizado */
export function hashDedup(valor: number, dataIsoStr: string, finalCartao: string, estabelecimento: string): string {
  return hashTexto(`${valor.toFixed(2)}|${dataIsoStr.slice(0, 10)}|${finalCartao || ''}|${normalizar(estabelecimento).slice(0, 20)}`)
}

export function gerarId(prefixo = 'x'): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Saudação conforme a hora. */
export function saudacao(apelido: string): string {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${apelido}!`
}
