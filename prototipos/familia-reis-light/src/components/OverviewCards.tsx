import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatarMoeda } from '../utils/format'

/** ==== RESUMO DO MÊS: Entradas (verde) e Saídas (vermelho) lado a lado ==== */
export function OverviewCards({ entradas, saidas }: { entradas: number; saidas: number }) {
  return (
    <section className="resumo" aria-label="Resumo do mês">
      <div className="card entradas">
        <span className="seta"><ArrowUpRight size={20} aria-hidden="true" /></span>
        <div><p className="titulo">Entradas</p><p className="valor num">{formatarMoeda(entradas)}</p></div>
      </div>
      <div className="card saidas">
        <span className="seta"><ArrowDownRight size={20} aria-hidden="true" /></span>
        <div><p className="titulo">Saídas</p><p className="valor num">{formatarMoeda(saidas)}</p></div>
      </div>
    </section>
  )
  /* ==== FIM DO RESUMO DO MÊS ==== */
}
