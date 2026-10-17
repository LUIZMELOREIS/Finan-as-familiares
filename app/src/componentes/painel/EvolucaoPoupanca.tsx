import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DadosPainel } from '../../tipos'
import { MESES_CURTOS, moeda } from '../../util/formato'
import { CORES, CartaoPainel, EIXO, SEM_LINHA, TooltipPainel, formatarEixoMoeda } from './tema'

/** "Evolução da poupança dos sonhos": área laranja acumulada no ano. */
export function EvolucaoPoupanca({ poupanca, ultimoMes }: { poupanca: DadosPainel['poupanca_projetos']; ultimoMes: number }) {
  const dados = poupanca.map((p, i) => ({ mes: MESES_CURTOS[i] ?? p.competencia, Guardado: i < ultimoMes ? p.total : null }))
  const ultimo = poupanca[Math.min(ultimoMes, poupanca.length) - 1]?.total ?? 0
  return (
    <CartaoPainel titulo="Evolução da poupança dos sonhos" subtitulo={`Guardado até agora: ${moeda(ultimo)}`}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-poupanca" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORES.laranja} stopOpacity={0.55} />
                <stop offset="100%" stopColor={CORES.laranja} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CORES.grade} />
            <XAxis dataKey="mes" tick={EIXO} axisLine={SEM_LINHA} tickLine={false} interval="equidistantPreserveStart" />
            <YAxis tick={EIXO} axisLine={SEM_LINHA} tickLine={false} tickFormatter={formatarEixoMoeda} width={56} />
            <Tooltip content={<TooltipPainel />} cursor={{ stroke: CORES.laranja, strokeWidth: 1 }} />
            <Area type="monotone" dataKey="Guardado" stroke={CORES.laranja} strokeWidth={2} fill="url(#grad-poupanca)" dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CartaoPainel>
  )
}
