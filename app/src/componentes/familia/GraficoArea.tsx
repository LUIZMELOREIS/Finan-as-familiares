/**
 * Gráfico de área de uma série (SVG próprio, no estilo da referência):
 * linha de 2 px com preenchimento em gradiente leve, grade e eixos `.axis`,
 * linha tracejada opcional da meta e dica (tooltip) ao passar o dedo/mouse.
 */
import { useId, useRef, useState, type PointerEvent } from 'react'
import { brl } from './calculos'

export interface PontoArea { rotulo: string; valor: number; destaque?: boolean }

interface Props {
  pontos: PontoArea[]
  /** Cor em hexadecimal (ver `corHex`). */
  cor: string
  /** Valor da linha tracejada horizontal (ex.: meta do projeto). */
  meta?: number
  rotuloMeta?: string
  /** Rótulo da série na dica. */
  nomeSerie?: string
  formato?: (v: number) => string
  /** Rótulo acessível do gráfico. */
  titulo: string
}

const W = 560, H = 210, L = 70, R = 16, T = 14, B = 26

function curto(v: number): string {
  if (v === 0) return 'R$ 0'
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) >= 10_000 ? 0 : 1 })}k`
  return brl(v)
}

export function GraficoArea({ pontos, cor, meta, rotuloMeta = 'Meta', nomeSerie = 'Total', formato = (v) => brl(v, 2), titulo }: Props) {
  const id = useId().replace(/:/g, '')
  const [ativo, setAtivo] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const n = pontos.length
  if (!n) return <p className="sub" style={{ margin: 0 }}>Ainda não há dados para o gráfico.</p>

  const maxDados = Math.max(0, ...pontos.map((p) => p.valor), meta ?? 0)
  const max = maxDados > 0 ? maxDados * 1.08 : 1
  const cw = n > 1 ? (W - L - R) / (n - 1) : 0
  const x = (i: number) => (n > 1 ? L + i * cw : (L + W - R) / 2)
  const y = (v: number) => H - B - (Math.max(0, v) / max) * (H - B - T)

  const linha = pontos.map((p, i) => {
    const xi = x(i), yi = y(p.valor)
    if (!i) return `M${xi},${yi}`
    const px = x(i - 1), cx = (px + xi) / 2
    return `C${cx},${y(pontos[i - 1].valor)} ${cx},${yi} ${xi},${yi}`
  }).join(' ')
  const area = n > 1 ? `${linha} L${x(n - 1)},${H - B} L${x(0)},${H - B}Z` : ''

  const passo = n > 14 ? Math.ceil(n / 12) : 1
  const ultimo = n - 1

  const aoMover = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || n < 2) return
    const caixa = svg.getBoundingClientRect()
    const px = ((e.clientX - caixa.left) / caixa.width) * W
    const i = Math.round(Math.min(ultimo, Math.max(0, (px - L) / cw)))
    setAtivo(i)
  }

  const i = ativo ?? ultimo
  const p = pontos[i]
  const dicaTexto = `${p.rotulo} · ${formato(p.valor)}`
  const dicaLarg = Math.min(W - 20, 12 + dicaTexto.length * 6.4)
  let dicaX = x(i) - dicaLarg / 2
  dicaX = Math.max(L - 40, Math.min(W - dicaLarg - 4, dicaX))
  const dicaY = Math.max(2, y(p.valor) - 34)

  return (
    <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${pontos.map((q) => `${q.rotulo}: ${formato(q.valor)}`).join('; ')}`}
      onPointerMove={aoMover} onPointerLeave={() => setAtivo(null)} style={{ touchAction: 'pan-y' }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity=".55" />
          <stop offset="1" stopColor={cor} stopOpacity=".04" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((g) => {
        const v = (max / 4) * g
        return (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text className="axis" x={L - 8} y={y(v) + 3} textAnchor="end">{curto(Math.round(v))}</text>
          </g>
        )
      })}
      {meta !== undefined && meta > 0 && (
        <g>
          <line x1={L} x2={W - R} y1={y(meta)} y2={y(meta)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 5" />
          <text className="axis" x={W - R} y={y(meta) - 5} textAnchor="end" style={{ fill: 'var(--muted)' }}>{rotuloMeta} {curto(meta)}</text>
        </g>
      )}
      {area && <path d={area} fill={`url(#g${id})`} />}
      <path d={linha} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((q, k) => (k % passo === 0 || k === ultimo) && (
        <text key={q.rotulo + k} className="axis" x={x(k)} y={H - 8} textAnchor="middle" style={q.destaque || k === i ? { fill: 'var(--text)' } : undefined}>{q.rotulo}</text>
      ))}
      {ativo !== null && <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="var(--faint)" strokeWidth="1" strokeDasharray="3 3" />}
      <circle cx={x(i)} cy={y(p.valor)} r="4.5" fill={cor} stroke="var(--card)" strokeWidth="2" />
      <g aria-hidden="true">
        <rect x={dicaX} y={dicaY} width={dicaLarg} height="22" rx="6" fill="var(--card-2)" stroke="var(--line)" />
        <text x={dicaX + dicaLarg / 2} y={dicaY + 15} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 10.5, fontFamily: 'Poppins, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{dicaTexto}</text>
      </g>
      <title>{nomeSerie}</title>
    </svg>
  )
}
