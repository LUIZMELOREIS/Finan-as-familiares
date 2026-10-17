import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarRectangleItem } from 'recharts/types/cartesian/Bar'
import type { DadosPainel } from '../../tipos'
import { MESES_CURTOS } from '../../util/formato'
import { CORES, CartaoPainel, EIXO, SEM_LINHA, TooltipPainel, formatarEixoMoeda } from './tema'

/** "Análise Mensal": barras agrupadas Jan–Dez — Salários (índigo) × Outras receitas (magenta). */
export function AnaliseMensal({ meses, mesSelecionado, aoTocarMes }: { meses: DadosPainel['meses']; mesSelecionado: number; aoTocarMes: (mes: number) => void }) {
  const dados = meses.map((m, i) => ({ mes: MESES_CURTOS[i], indice: i + 1, Salários: m.salarios, 'Outras receitas': m.outras_receitas }))
  const clique = (d: BarRectangleItem) => { const i = (d.payload as { indice?: number } | undefined)?.indice; if (i) aoTocarMes(i) }
  return (
    <CartaoPainel titulo="Análise Mensal" subtitulo="Salários × outras receitas, mês a mês. Toque em um mês para selecioná-lo.">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CORES.grade} />
            <XAxis dataKey="mes" tick={EIXO} axisLine={SEM_LINHA} tickLine={false} interval="equidistantPreserveStart" />
            <YAxis tick={EIXO} axisLine={SEM_LINHA} tickLine={false} tickFormatter={formatarEixoMoeda} width={56} />
            <Tooltip content={<TooltipPainel />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, color: CORES.texto }} />
            <Bar dataKey="Salários" fill={CORES.indigo} radius={[4, 4, 0, 0]} maxBarSize={18} onClick={clique} style={{ cursor: 'pointer' }} isAnimationActive={false} />
            <Bar dataKey="Outras receitas" fill={CORES.magenta} radius={[4, 4, 0, 0]} maxBarSize={18} onClick={clique} style={{ cursor: 'pointer' }} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-suave mt-1">Mês selecionado: <b className="text-texto">{MESES_CURTOS[mesSelecionado - 1]}</b></div>
    </CartaoPainel>
  )
}
