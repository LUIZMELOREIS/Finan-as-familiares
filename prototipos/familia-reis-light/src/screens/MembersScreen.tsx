import { MemberBreakdown } from '../components/MemberBreakdown'
import { TRANSACOES } from '../data/mock'

/** ==== ANÁLISE POR MEMBRO ==== */
export function MembersScreen() {
  return (
    <>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Membros</h1>
        <p style={{ color: 'var(--muted)' }}>Como os gastos do mês se dividem entre a família.</p>
      </header>
      <MemberBreakdown transacoes={TRANSACOES} />
    </>
  )
  /* ==== FIM DA ANÁLISE POR MEMBRO ==== */
}
