/**
 * Consumo mês a mês (kWh, m³…) em barras SVG próprias: uma série, marcas finas
 * com topo arredondado, rótulos só nos últimos dois meses e aviso em vermelho
 * quando o consumo subiu mais de 20% em relação ao mês passado.
 */
import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import { moeda, nomeCompetencia } from '../../util/formato'
import { corVar } from '../Icone'
import { Icone } from '../Icone'

interface PontoConsumo { competencia: string; consumo_valor: number; consumo_unidade: string; valor: number }

function barra(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h / 2, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

export function GraficoConsumo({ contaFixaId, cor = 'lilac' }: { contaFixaId: string; cor?: string }) {
  const [dados, setDados] = useState<PontoConsumo[] | null>(null)
  useEffect(() => {
    let vivo = true
    api<PontoConsumo[]>('consumo_historico', { conta_fixa_id: contaFixaId })
      .then((d) => vivo && setDados(d.slice(-12)))
      .catch(() => vivo && setDados([]))
    return () => { vivo = false }
  }, [contaFixaId])

  if (dados === null) return <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Carregando histórico…</p>
  if (dados.length < 2) return <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Ainda não há histórico suficiente para comparar.</p>

  const temConsumo = dados.some((d) => d.consumo_valor > 0)
  const unidade = dados.find((d) => d.consumo_unidade)?.consumo_unidade ?? ''
  const serie = dados.map((d) => (temConsumo ? d.consumo_valor : d.valor))
  const max = Math.max(...serie, 1)
  const ultimo = serie[serie.length - 1]
  const anterior = serie[serie.length - 2]
  const variacao = anterior > 0 ? Math.round(((ultimo - anterior) / anterior) * 100) : 0
  const alerta = variacao > 20
  const fmt = (v: number) => (temConsumo ? `${Math.round(v)} ${unidade}` : moeda(v))

  const W = 480, H = 140, topo = 18, base = 116, mx = 6
  const passo = (W - mx * 2) / serie.length
  const larg = Math.min(20, passo * 0.45)
  const corBase = corVar(cor)

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: '#C9CAD6', fontWeight: 500 }}>{temConsumo ? `Consumo mês a mês (${unidade})` : 'Valor mês a mês'}</span>
        <span className={`tag num ${alerta ? 'red' : variacao < 0 ? 'ok' : 'proj'}`}>{variacao > 0 ? '+' : ''}{variacao}% vs. mês anterior</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Histórico: ${serie.map((v, i) => `${nomeCompetencia(dados[i].competencia, true)} ${fmt(v)}`).join(', ')}`}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line)" />
        {serie.map((v, i) => {
          const h = Math.max(2, (v / max) * (base - topo))
          const x = mx + i * passo + (passo - larg) / 2
          const ehUltimo = i === serie.length - 1
          const rotulo = i >= serie.length - 2
          const rotuloMes = serie.length <= 8 || (serie.length - 1 - i) % 2 === 0
          return (
            <g key={dados[i].competencia}>
              <title>{`${nomeCompetencia(dados[i].competencia)}: ${fmt(v)}`}</title>
              <path d={barra(x, base - h, larg, h)} fill={ehUltimo && alerta ? 'var(--red)' : corBase} opacity={ehUltimo ? 1 : 0.55} />
              {rotulo && <text className="axis" x={x + larg / 2} y={base - h - 5} textAnchor="middle" fill="var(--muted)">{Math.round(v)}</text>}
              {rotuloMes && <text className="axis" x={x + larg / 2} y={base + 13} textAnchor="middle" fill={ehUltimo ? 'var(--text)' : undefined}>{nomeCompetencia(dados[i].competencia, true).split('/')[0].toLowerCase()}</text>}
            </g>
          )
        })}
      </svg>
      {alerta && (
        <p className="flex items-start" style={{ gap: 8, marginTop: 6, fontSize: 12.5, color: '#FF8B91', background: 'color-mix(in srgb, var(--red) 12%, transparent)', borderRadius: 9, padding: '8px 10px' }}>
          <Icone nome="triangle-alert" />
          <span>Subiu {variacao}% em relação ao mês passado ({fmt(anterior)} para {fmt(ultimo)}). Vale conferir vazamento, aparelho novo ou erro de leitura.</span>
        </p>
      )}
    </div>
  )
}
