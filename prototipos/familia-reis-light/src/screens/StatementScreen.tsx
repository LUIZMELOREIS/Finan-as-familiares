import { TransactionList } from '../components/TransactionList'
import { TRANSACOES } from '../data/mock'
import { mesReferencia } from '../utils/format'

/** ==== EXTRATO COMPLETO ==== */
export function StatementScreen() {
  return (
    <>
      <header>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Extrato</h1>
        <p style={{ color: 'var(--muted)' }}>{mesReferencia()}</p>
      </header>
      <TransactionList transacoes={TRANSACOES} mostrarData />
    </>
  )
  /* ==== FIM DO EXTRATO ==== */
}
