import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PieSectorDataItem } from 'recharts/types/polar/Pie'
import { moeda, porcentagem } from '../../util/formato'
import { CartaoPainel, Legenda, TooltipPainel, separarCoresParecidas } from './tema'

export interface FatiaDonut { id: string; nome: string; cor: string; valor: number }

/**
 * Donut de despesas por grupo com o % no centro (participação das despesas na renda)
 * e legenda ao lado com os valores. Toque na fatia ou na legenda abre os lançamentos.
 */
export function Donut({ titulo, subtitulo, fatias, despesas, receitas, aoTocar }: {
  titulo: string
  subtitulo?: string
  fatias: FatiaDonut[]
  despesas: number
  receitas: number
  aoTocar: (grupoId: string) => void
}) {
  const dados = separarCoresParecidas(fatias.filter((f) => f.valor > 0))
  const total = dados.reduce((s, f) => s + f.valor, 0)
  const pctRenda = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0
  const itensLegenda = dados.map((f) => ({ ...f, pct: porcentagem(f.valor, total) }))

  return (
    <CartaoPainel titulo={titulo} subtitulo={subtitulo}>
      {dados.length === 0 ? (
        <div className="text-sm text-suave py-8 text-center">Sem despesas neste período.</div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<TooltipPainel titulo={(_l, p) => String(p[0]?.name ?? '')} />} />
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  cornerRadius={3}
                  stroke="var(--bg-card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  onClick={(d: PieSectorDataItem) => { const id = (d.payload as FatiaDonut | undefined)?.id; if (id) aoTocar(id) }}
                  style={{ cursor: 'pointer' }}
                >
                  {dados.map((f) => <Cell key={f.id} fill={f.cor} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-extrabold text-2xl tabular-nums leading-none">{pctRenda}%</div>
              <div className="text-[11px] text-suave text-center leading-tight mt-1">da renda</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Legenda itens={itensLegenda} aoTocar={aoTocar} />
            <div className="text-xs text-suave mt-2 px-1">Total: <b className="text-texto">{moeda(total)}</b></div>
          </div>
        </div>
      )}
    </CartaoPainel>
  )
}
