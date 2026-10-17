import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import { moeda, nomeCompetencia } from '../../util/formato'

interface PontoConsumo { competencia: string; consumo_valor: number; consumo_unidade: string; valor: number }

/** Gráfico de barras (SVG próprio) do consumo mês a mês, com alerta quando sobe mais de 20%. */
export function GraficoConsumo({ contaFixaId }: { contaFixaId: string }) {
  const [dados, setDados] = useState<PontoConsumo[] | null>(null)
  useEffect(() => {
    let vivo = true
    api<PontoConsumo[]>('consumo_historico', { conta_fixa_id: contaFixaId })
      .then((d) => vivo && setDados(d.slice(-12)))
      .catch(() => vivo && setDados([]))
    return () => { vivo = false }
  }, [contaFixaId])

  if (dados === null) return <p className="text-sm text-suave">Carregando histórico…</p>
  if (dados.length < 2) return <p className="text-sm text-suave">Ainda não há histórico suficiente para comparar.</p>

  const temConsumo = dados.some((d) => d.consumo_valor > 0)
  const unidade = dados.find((d) => d.consumo_unidade)?.consumo_unidade ?? ''
  const serie = dados.map((d) => (temConsumo ? d.consumo_valor : d.valor))
  const max = Math.max(...serie, 1)
  const ultimo = serie[serie.length - 1]
  const anterior = serie[serie.length - 2]
  const variacao = anterior > 0 ? Math.round(((ultimo - anterior) / anterior) * 100) : 0
  const alerta = variacao > 20

  const L = 320, A = 150, base = 120, margem = 6
  const larguraBarra = (L - margem * 2) / serie.length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold">{temConsumo ? `Consumo mês a mês (${unidade})` : 'Valor mês a mês'}</h3>
        <span className={`text-sm font-bold ${alerta ? 'text-vermelho' : variacao < 0 ? 'text-verde' : 'text-suave'}`}>{variacao > 0 ? '▲' : variacao < 0 ? '▼' : '•'} {Math.abs(variacao)}%</span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img" aria-label={`Gráfico: ${serie.map((v, i) => `${nomeCompetencia(dados[i].competencia, true)} ${v}`).join(', ')}`}>
        {serie.map((v, i) => {
          const h = Math.max(2, (v / max) * (base - 20))
          const x = margem + i * larguraBarra + larguraBarra * 0.15
          const ehUltimo = i === serie.length - 1
          const cor = ehUltimo && alerta ? 'var(--vermelho)' : ehUltimo ? 'var(--primaria-sel)' : 'color-mix(in srgb, var(--primaria) 55%, transparent)'
          return (
            <g key={dados[i].competencia}>
              <rect x={x} y={base - h} width={larguraBarra * 0.7} height={h} rx={4} fill={cor} />
              <text x={x + larguraBarra * 0.35} y={base - h - 4} textAnchor="middle" fontSize="10" fill="var(--texto-suave)">{temConsumo ? Math.round(v) : Math.round(v)}</text>
              <text x={x + larguraBarra * 0.35} y={base + 14} textAnchor="middle" fontSize="9" fill="var(--texto-suave)">{nomeCompetencia(dados[i].competencia, true).split('/')[0]}</text>
            </g>
          )
        })}
        <line x1={0} x2={L} y1={base} y2={base} stroke="var(--borda)" />
      </svg>
      {alerta && (
        <p className="mt-2 text-sm font-semibold text-vermelho bg-vermelho/10 rounded-xl p-3">
          ⚠️ Subiu {variacao}% em relação ao mês passado ({temConsumo ? `${anterior} → ${ultimo} ${unidade}` : `${moeda(anterior)} → ${moeda(ultimo)}`}). Vale conferir se houve vazamento, aparelho novo ou erro de leitura.
        </p>
      )}
    </div>
  )
}
