import { nomeCompetencia, somarMeses, competenciaDe } from '../../util/formato'

/** ‹ Outubro de 2026 › — seletor de competência. */
export function SeletorMes({ competencia, aoMudar }: { competencia: string; aoMudar: (c: string) => void }) {
  const ehAtual = competencia === competenciaDe()
  return (
    <div className="flex items-center justify-between gap-2">
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, -1))} aria-label="Mês anterior">
        <span className="text-2xl leading-none" aria-hidden>‹</span>
      </button>
      <button className="flex-1 text-center font-bold text-lg min-h-12 rounded-xl hover:bg-card-hover" onClick={() => aoMudar(competenciaDe())} aria-label={`${nomeCompetencia(competencia)}. Toque para voltar ao mês atual`}>
        {nomeCompetencia(competencia)}
        {!ehAtual && <span className="block text-xs font-medium text-suave">toque para voltar ao mês atual</span>}
      </button>
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, 1))} aria-label="Próximo mês">
        <span className="text-2xl leading-none" aria-hidden>›</span>
      </button>
    </div>
  )
}
