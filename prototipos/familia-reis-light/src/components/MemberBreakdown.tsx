import { CORES_MEMBRO, type Membro, type Transacao } from '../data/mock'
import { formatarMoeda } from '../utils/format'

/** Soma as saídas por membro (entradas ficam de fora). */
export function gastosPorMembro(transacoes: Transacao[]) {
  const mapa = new Map<Membro, number>()
  transacoes.filter((t) => t.valor < 0).forEach((t) => mapa.set(t.membro, (mapa.get(t.membro) ?? 0) + Math.abs(t.valor)))
  return [...mapa.entries()].map(([membro, total]) => ({ membro, total })).sort((a, b) => b.total - a.total)
}

/** ==== ANÁLISE POR MEMBRO: barras proporcionais ao gasto de cada pessoa ==== */
export function MemberBreakdown({ transacoes }: { transacoes: Transacao[] }) {
  const linhas = gastosPorMembro(transacoes)
  const total = linhas.reduce((s, l) => s + l.total, 0) || 1
  return (
    <section className="card" aria-label="Gastos por membro">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Quem gastou neste mês</h2>
      {linhas.map(({ membro, total: t }) => {
        const pct = Math.round((t / total) * 100)
        return (
          <div key={membro} className="membro">
            <div className="cabeca">
              <span className="avatar" style={{ background: CORES_MEMBRO[membro] }} aria-hidden="true">{membro[0]}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{membro}</span>
              <span className="num" style={{ fontWeight: 800 }}>{formatarMoeda(t)}</span>
              <span className="num" style={{ color: 'var(--muted)', fontSize: 13, width: 40, textAlign: 'right' }}>{pct}%</span>
            </div>
            <div className="trilho" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${membro}: ${pct}% dos gastos`}>
              <div className="barra" style={{ width: `${pct}%`, background: CORES_MEMBRO[membro] }} />
            </div>
          </div>
        )
      })}
    </section>
  )
  /* ==== FIM DA ANÁLISE POR MEMBRO ==== */
}
