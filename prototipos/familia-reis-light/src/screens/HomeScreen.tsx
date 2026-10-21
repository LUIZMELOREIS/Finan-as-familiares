import { Header } from '../components/Header'
import { BalanceCard } from '../components/BalanceCard'
import { OverviewCards } from '../components/OverviewCards'
import { BudgetProgress } from '../components/BudgetProgress'
import { TransactionList } from '../components/TransactionList'
import { FAMILIA, RESUMO, TRANSACOES } from '../data/mock'

/** ==== TELA INICIAL (PAINEL) ==== */
export function HomeScreen({ aoVerExtrato }: { aoVerExtrato: () => void }) {
  const ultimasSaidas = TRANSACOES.filter((t) => t.valor < 0).slice(0, 3)
  return (
    <>
      <Header familia={FAMILIA} pendentes={RESUMO.contasPendentes} />
      <BalanceCard saldo={RESUMO.saldo} />
      <OverviewCards entradas={RESUMO.entradas} saidas={RESUMO.saidas} />
      <BudgetProgress gasto={RESUMO.saidas} limite={RESUMO.limiteMensal} />
      <TransactionList titulo="Quem gastou" transacoes={ultimasSaidas} aoVerTudo={aoVerExtrato} />
    </>
  )
  /* ==== FIM DA TELA INICIAL ==== */
}
