import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { moeda, moedaCurta, nomeCompetencia } from '../../util/formato'

const INDIGO = '#5B5BE0'

interface Ponto {
  competencia: string
  total: number
}

function Dica({ active, payload }: { active?: boolean; payload?: Array<{ payload: Ponto }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="card px-3 py-2 text-sm">
      <div className="text-suave">{nomeCompetencia(p.competencia)}</div>
      <div className="font-bold flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: INDIGO }} aria-hidden />
        Guardado: {moeda(p.total)}
      </div>
    </div>
  )
}

/** Área da evolução acumulada do sonho (uma série só; a meta é uma linha de referência). */
export function GraficoEvolucao({ dados, meta }: { dados: Ponto[]; meta: number }) {
  if (dados.length < 2) return <p className="text-suave text-sm">O gráfico aparece quando houver pelo menos dois meses de história.</p>
  const maximo = Math.max(meta, ...dados.map((d) => d.total))
  const ultimo = dados[dados.length - 1]
  return (
    <div style={{ width: '100%', height: 210 }} aria-label="Evolução do valor guardado por mês" role="img">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="area-evolucao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INDIGO} stopOpacity={0.22} />
              <stop offset="100%" stopColor={INDIGO} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--borda)" strokeWidth={1} />
          <XAxis dataKey="competencia" tickFormatter={(c: string) => nomeCompetencia(c, true)} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={[0, Math.ceil(maximo * 1.05)]} tickFormatter={(v: number) => moedaCurta(v)} tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} width={64} tickCount={4} />
          <Tooltip content={<Dica />} cursor={{ stroke: 'var(--texto-suave)', strokeWidth: 1 }} />
          <ReferenceLine y={meta} stroke="var(--texto-suave)" strokeDasharray="4 4" label={{ value: `Meta ${moedaCurta(meta)}`, position: 'insideTopRight', fill: 'var(--texto-suave)', fontSize: 12 }} />
          <Area type="monotone" dataKey="total" stroke={INDIGO} strokeWidth={2} fill="url(#area-evolucao)" dot={false} activeDot={{ r: 5, fill: INDIGO, stroke: 'var(--bg-card)', strokeWidth: 2 }} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
      <span className="sr-only">Último mês: {nomeCompetencia(ultimo.competencia)} com {moeda(ultimo.total)} guardados.</span>
    </div>
  )
}
