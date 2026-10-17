import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DadosPainel } from '../../tipos'
import { MESES_CURTOS } from '../../util/formato'
import { CORES, CartaoPainel, EIXO, SEM_LINHA, TooltipPainel, formatarEixoMoeda } from './tema'

/** "Receitas × Despesas": linhas Jan–Dez. Toque num ponto seleciona o mês. */
export function ReceitasDespesas({ meses, ultimoMes, aoTocarMes }: { meses: DadosPainel['meses']; ultimoMes: number; aoTocarMes: (mes: number) => void }) {
  // Meses futuros ficam em branco (null) em vez de cair para zero.
  const dados = meses.map((m, i) => ({ mes: MESES_CURTOS[i], Receitas: i < ultimoMes ? m.receitas : null, Despesas: i < ultimoMes ? m.despesas : null }))
  return (
    <CartaoPainel titulo="Receitas × Despesas" subtitulo="Evolução no ano">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} onClick={(e) => { const i = typeof e?.activeTooltipIndex === 'number' ? e.activeTooltipIndex : Number(e?.activeTooltipIndex); if (!Number.isNaN(i) && i >= 0) aoTocarMes(i + 1) }} style={{ cursor: 'pointer' }}>
            <CartesianGrid vertical={false} stroke={CORES.grade} />
            <XAxis dataKey="mes" tick={EIXO} axisLine={SEM_LINHA} tickLine={false} interval="equidistantPreserveStart" />
            <YAxis tick={EIXO} axisLine={SEM_LINHA} tickLine={false} tickFormatter={formatarEixoMoeda} width={56} />
            <Tooltip content={<TooltipPainel />} cursor={{ stroke: CORES.texto, strokeWidth: 1 }} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, color: CORES.texto }} />
            <Line type="monotone" dataKey="Receitas" stroke={CORES.verde} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--bg-card)', fill: CORES.verde }} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="Despesas" stroke={CORES.vermelho} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--bg-card)', fill: CORES.vermelho }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CartaoPainel>
  )
}
