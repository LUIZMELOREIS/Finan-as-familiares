import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarRectangleItem } from 'recharts/types/cartesian/Bar'
import type { Grupo } from '../../tipos'
import { moeda, moedaCurta } from '../../util/formato'
import { CORES, CartaoPainel, EIXO, SEM_LINHA, TooltipPainel } from './tema'

export interface BarraCategoria { id: string; nome: string; valor: number; cor: string }

/** "Detalhamento de Despesas": barras horizontais das categorias do grupo + lista de grupos clicável. */
export function Detalhamento({ grupos, grupoSel, aoMudarGrupo, categorias, totaisPorGrupo, aoTocarCategoria }: {
  grupos: Grupo[]
  grupoSel: string
  aoMudarGrupo: (id: string) => void
  categorias: BarraCategoria[]
  totaisPorGrupo: Record<string, number>
  aoTocarCategoria: (categoriaId: string) => void
}) {
  const grupo = grupos.find((g) => g.id === grupoSel)
  const dados = [...categorias].filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 10)
  const altura = Math.max(160, dados.length * 34 + 20)
  return (
    <CartaoPainel titulo="Detalhamento de Despesas" subtitulo={grupo ? `${grupo.icone} ${grupo.nome} — toque numa barra para ver os lançamentos` : undefined}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_190px] gap-3">
        <div style={{ height: altura }} className="min-w-0">
          {dados.length === 0 ? <div className="text-sm text-suave py-8 text-center">Sem despesas neste grupo no mês.</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={118} tick={{ ...EIXO, fill: 'var(--texto)' }} axisLine={SEM_LINHA} tickLine={false} interval={0} />
                <Tooltip content={<TooltipPainel />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="valor" name="Gasto" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} style={{ cursor: 'pointer' }}
                  onClick={(d: BarRectangleItem) => { const id = (d.payload as BarraCategoria | undefined)?.id; if (id) aoTocarCategoria(id) }}>
                  {dados.map((d) => <Cell key={d.id} fill={d.cor || grupo?.cor || CORES.indigo} />)}
                  <LabelList dataKey="valor" position="right" formatter={(v) => moedaCurta(Number(v))} style={{ fontSize: 12, fill: CORES.texto }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="flex md:flex-col gap-1.5 overflow-x-auto rolagem-escondida -mx-1 px-1" aria-label="Grupos">
          {grupos.filter((g) => g.tipo !== 'receita').map((g) => {
            const sel = g.id === grupoSel
            return (
              <li key={g.id} className="shrink-0">
                <button type="button" onClick={() => aoMudarGrupo(g.id)} aria-pressed={sel}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 min-h-12 text-left border ${sel ? 'border-transparent text-white' : 'border-borda bg-painel hover:bg-card-hover'}`}
                  style={sel ? { background: g.cor } : undefined}>
                  <span className="text-lg" aria-hidden>{g.icone}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold leading-tight truncate">{g.nome}</span>
                    <span className={`block text-xs tabular-nums ${sel ? 'text-white/85' : 'text-suave'}`}>{moeda(totaisPorGrupo[g.id] ?? 0)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </CartaoPainel>
  )
}
