import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { MESES_CURTOS, moeda } from '../../util/formato'
import { TooltipPainel } from './tema'

/** KPI com número grande, variação vs. mês anterior e sparkline de área com gradiente. */
export function Kpi({ titulo, valor, anterior, serie, ultimoMes, cor, id, aoTocar }: {
  titulo: string
  valor: number
  anterior: number | null
  serie: number[]
  ultimoMes: number // meses futuros não entram na sparkline
  cor: string
  id: string
  aoTocar?: () => void
}) {
  const dados = serie.slice(0, Math.max(1, ultimoMes)).map((v, i) => ({ mes: MESES_CURTOS[i], valor: v }))
  const variacao = anterior === null || anterior === 0 ? null : ((valor - anterior) / Math.abs(anterior)) * 100
  const Tag = aoTocar ? 'button' : 'div'
  return (
    <Tag className={`card p-4 text-left min-w-0 overflow-hidden relative ${aoTocar ? 'card-toque' : ''}`} onClick={aoTocar} aria-label={`${titulo}: ${moeda(valor)}${variacao !== null ? `, ${variacao >= 0 ? 'subiu' : 'caiu'} ${Math.abs(variacao).toFixed(0)}% em relação ao mês anterior` : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-suave">{titulo}</div>
      <div className="numero-grande !text-2xl sm:!text-3xl tabular-nums" style={{ color: cor }}>{moeda(valor)}</div>
      <div className="text-xs mt-0.5 h-4">
        {variacao === null ? <span className="text-suave">sem mês anterior para comparar</span> : (
          <span className="text-suave"><span className="font-semibold text-texto">{variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(0)}%</span> vs. mês anterior ({moeda(anterior ?? 0)})</span>
        )}
      </div>
      <div className="h-16 mt-2 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity={0.6} />
                <stop offset="100%" stopColor={cor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip content={<TooltipPainel titulo={(l) => String(l ?? '')} />} cursor={{ stroke: cor, strokeWidth: 1 }} />
            <Area type="monotone" dataKey="valor" name={titulo} stroke={cor} strokeWidth={2} fill={`url(#grad-${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--bg-card)' }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Tag>
  )
}
