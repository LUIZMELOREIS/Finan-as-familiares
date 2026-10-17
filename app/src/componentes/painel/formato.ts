/** Formatação e escalas dos gráficos do Painel — iguais às funções do referencia_visual.html. */
import { MESES } from '../../util/formato'

/** `R$ 16.600` (sem centavos) ou `R$ 412,37` com `casas = 2`, como o `brl` da referência. */
export function brl(v: number, casas = 0): string {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Meses em minúsculo e 3 letras, como no eixo da referência (jan … dez). */
export const M = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Nome do mês em minúsculo ("setembro") para "vs setembro". */
export function mesMinusculo(indice: number): string {
  return (MESES[((indice % 12) + 12) % 12] ?? '').toLowerCase()
}

/** Teto "redondo" para o eixo com 4 divisões (a referência usava 24.000 e 26.000 fixos). */
export function tetoEixo(maximo: number): number {
  if (!(maximo > 0)) return 4000
  const bruto = maximo / 4
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const n = bruto / pot
  const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10) * pot
  return passo * 4
}

/** Rótulo do eixo: `R$ 0`, `R$ 6k`, `R$ 6,5k`. */
export function rotuloEixo(v: number): string {
  if (!v) return 'R$ 0'
  return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
}

/** Dias inteiros de hoje até uma data ISO (negativo = já passou). */
export function diasAte(iso: string): number {
  const hoje = new Date()
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - h) / 86_400_000)
}

/** "em 3 dias" / "hoje" / "amanhã" / "venceu" — etiqueta das saídas lidas do e-mail. */
export function rotuloPrazo(iso: string): string {
  const d = diasAte(iso)
  if (d < 0) return 'venceu'
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  return `em ${d} dias`
}

/** Soma simples. */
export const soma = (a: number[]) => a.reduce((x, y) => x + y, 0)

/** "Receitas · nov e dez previstos" — subtítulo da Análise mensal calculado a partir dos meses previstos. */
export function subtituloPrevistos(previstos: boolean[]): string {
  const idx = previstos.map((p, i) => (p ? i : -1)).filter((i) => i >= 0)
  if (!idx.length) return 'Receitas'
  if (idx.length === 1) return `Receitas · ${M[idx[0]]} previsto`
  if (idx.length === 2) return `Receitas · ${M[idx[0]]} e ${M[idx[1]]} previstos`
  return `Receitas · ${M[idx[0]]} a ${M[idx[idx.length - 1]]} previstos`
}
