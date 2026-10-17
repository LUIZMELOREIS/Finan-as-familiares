import { MESES, somarMeses } from '../../util/formato'

/** ‹ Mês de Ano › com botões grandes. */
export function SeletorMes({ competencia, aoMudar, maxima }: { competencia: string; aoMudar: (c: string) => void; maxima?: string }) {
  const podeAvancar = !maxima || competencia < maxima
  return (
    <div className="flex items-center justify-between gap-2">
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, -1))} aria-label="Mês anterior">
        <span className="text-xl" aria-hidden>‹</span> <span className="text-sm">Anterior</span>
      </button>
      <div className="text-center flex-1 min-w-0 leading-tight" aria-live="polite">
        <div className="font-bold">{MESES[Number(competencia.slice(5, 7)) - 1] ?? competencia}</div>
        <div className="text-xs text-suave">{competencia.slice(0, 4)}</div>
      </div>
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, 1))} disabled={!podeAvancar} aria-label="Próximo mês">
        <span className="text-sm">Próximo</span> <span className="text-xl" aria-hidden>›</span>
      </button>
    </div>
  )
}
