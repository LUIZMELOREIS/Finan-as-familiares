import { formatarMoeda } from '../utils/format'

/** Cor da barra conforme o percentual gasto: verde até 60 %, amarelo até 85 %, vermelho acima. */
export function corDoOrcamento(percentual: number) {
  if (percentual < 60) return 'var(--green)'
  if (percentual < 85) return 'var(--yellow)'
  return 'var(--red)'
}

/** ==== ORÇAMENTO DO MÊS: barra de progresso com limiares dinâmicos ==== */
export function BudgetProgress({ gasto, limite }: { gasto: number; limite: number }) {
  const percentual = limite > 0 ? Math.min(100, Math.round((gasto / limite) * 100)) : 0
  return (
    <section className="card orcamento" aria-label="Orçamento do mês">
      <div className="topo">
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Limite mensal da casa</h2>
        <span className="num" style={{ fontWeight: 800, color: corDoOrcamento(percentual) }}>{percentual}%</span>
      </div>
      <div className="trilho" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} aria-label="Percentual do limite já gasto">
        <div className="barra" style={{ width: `${percentual}%`, backgroundColor: corDoOrcamento(percentual) }} />
      </div>
      <div className="legenda">
        <span>{formatarMoeda(gasto)} gastos</span>
        <span>de {formatarMoeda(limite)}</span>
      </div>
    </section>
  )
  /* ==== FIM DO ORÇAMENTO ==== */
}
