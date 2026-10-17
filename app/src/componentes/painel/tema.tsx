/**
 * Tema dos gráficos do painel: paleta do projeto (igual à imagem de referência),
 * tooltip em português com moeda(), eixos discretos e o cartão padrão.
 */
import type { ReactNode } from 'react'
import { moeda, moedaCurta } from '../../util/formato'

export const CORES = {
  indigo: '#5B5BE0',
  magenta: '#BD55C7',
  amarelo: '#F2C552',
  laranja: '#E0852F',
  verde: '#4CB963',
  vermelho: '#E5535B',
  azul: '#4FA3E0',
  grade: 'rgba(169,170,184,0.18)',
  texto: '#A9AAB8',
}

/** Estilo dos textos dos eixos (≥ 12 px, cor de texto suave). */
export const EIXO = { fontSize: 12, fill: CORES.texto } as const
export const SEM_LINHA = { stroke: 'transparent' } as const

export const formatarEixoMoeda = (v: number) => moedaCurta(v)

interface ItemTooltip { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

/** Tooltip em pt-BR: título + uma linha por série com a cor e o valor em R$. */
export function TooltipPainel({ active, payload, label, titulo }: { active?: boolean; payload?: ItemTooltip[]; label?: string | number; titulo?: (label: string | number | undefined, payload: ItemTooltip[]) => string }) {
  if (!active || !payload?.length) return null
  const cab = titulo ? titulo(label, payload) : label
  return (
    <div className="card px-3 py-2 text-sm shadow-xl" style={{ background: 'var(--bg-card)' }}>
      {cab !== undefined && cab !== '' && <div className="font-semibold mb-1">{String(cab)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular-nums">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || (p.payload?.cor as string) }} aria-hidden />
          <span className="text-suave flex-1">{String(p.name ?? p.dataKey ?? '')}</span>
          <span className="font-semibold">{moeda(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  )
}

/** Cartão do painel com título e subtítulo discretos. */
export function CartaoPainel({ titulo, subtitulo, acao, children, className = '' }: { titulo: string; subtitulo?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 min-w-0 ${className}`} aria-label={titulo}>
      <header className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h2 className="font-bold leading-tight">{titulo}</h2>
          {subtitulo && <div className="text-xs text-suave">{subtitulo}</div>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  )
}

/** Legenda manual (cor + nome + valor), usada ao lado dos donuts e nas barras. */
export function Legenda({ itens, aoTocar }: { itens: Array<{ id: string; nome: string; cor: string; valor: number; pct?: number }>; aoTocar?: (id: string) => void }) {
  return (
    <ul className="space-y-1.5 min-w-0">
      {itens.map((i) => {
        const conteudo = (
          <>
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: i.cor }} aria-hidden />
            <span className="flex-1 truncate text-sm">{i.nome}</span>
            <span className="text-sm font-semibold tabular-nums">{moeda(i.valor)}</span>
            {i.pct !== undefined && <span className="text-xs text-suave tabular-nums w-10 text-right">{i.pct}%</span>}
          </>
        )
        return (
          <li key={i.id}>
            {aoTocar ? (
              <button type="button" className="w-full flex items-center gap-2 min-h-9 rounded-lg px-1 hover:bg-card-hover text-left" onClick={() => aoTocar(i.id)} aria-label={`${i.nome}: ${moeda(i.valor)}. Ver lançamentos`}>{conteudo}</button>
            ) : (
              <div className="flex items-center gap-2 min-h-9 px-1">{conteudo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Reordena fatias para que índigo e magenta (parecidas para quem tem daltonismo
 * protan) não fiquem lado a lado sempre que houver outra cor disponível.
 */
export function separarCoresParecidas<T extends { cor: string }>(itens: T[]): T[] {
  const parecidas = new Set([CORES.indigo.toLowerCase(), CORES.magenta.toLowerCase()])
  const restantes = [...itens]
  const saida: T[] = []
  while (restantes.length) {
    const anterior = saida[saida.length - 1]
    let idx = 0
    if (anterior && parecidas.has(anterior.cor.toLowerCase())) {
      const alt = restantes.findIndex((r) => !parecidas.has(r.cor.toLowerCase()))
      if (alt >= 0) idx = alt
    }
    saida.push(restantes.splice(idx, 1)[0])
  }
  return saida
}
