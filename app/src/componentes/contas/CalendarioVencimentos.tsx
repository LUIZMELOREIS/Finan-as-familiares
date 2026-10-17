import type { ContaAPagar } from '../../tipos'
import { hojeIso } from '../../util/formato'

export type SituacaoConta = 'paga' | 'vencida' | 'breve' | 'aberta'

/** Situação de uma conta em relação a hoje: paga, vencida, vence em ≤ 3 dias, aberta. */
export function situacaoDe(c: ContaAPagar, hoje = hojeIso()): SituacaoConta {
  if (c.status === 'paga') return 'paga'
  if (c.vencimento < hoje) return 'vencida'
  const dias = Math.round((new Date(c.vencimento).getTime() - new Date(hoje).getTime()) / 86_400_000)
  return dias <= 3 ? 'breve' : 'aberta'
}

export const COR_SITUACAO: Record<SituacaoConta, string> = { vencida: 'var(--vermelho)', breve: 'var(--amarelo)', aberta: 'var(--primaria)', paga: 'var(--verde)' }
export const NOME_SITUACAO: Record<SituacaoConta, string> = { vencida: 'Vencida', breve: 'Vence em breve', aberta: 'Em aberto', paga: 'Paga' }

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Grade simples do mês com bolinhas coloridas nos dias de vencimento. */
export function CalendarioVencimentos({ competencia, contas, previstas, diaSelecionado, aoEscolherDia }: {
  competencia: string
  contas: ContaAPagar[]
  previstas: number[] // dias com conta prevista (ainda sem fatura)
  diaSelecionado: number | null
  aoEscolherDia: (dia: number | null) => void
}) {
  const [ano, mes] = competencia.split('-').map(Number)
  const primeiro = new Date(ano, mes - 1, 1).getDay()
  const total = new Date(ano, mes, 0).getDate()
  const hoje = hojeIso()
  const hojeDia = hoje.slice(0, 7) === competencia ? Number(hoje.slice(8, 10)) : -1
  const porDia = new Map<number, SituacaoConta[]>()
  for (const c of contas) {
    if (!c.vencimento.startsWith(competencia)) continue
    const d = Number(c.vencimento.slice(8, 10))
    porDia.set(d, [...(porDia.get(d) ?? []), situacaoDe(c, hoje)])
  }
  const celulas: Array<number | null> = [...Array<null>(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-suave font-semibold mb-1" aria-hidden>
        {DIAS_SEMANA.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendário de vencimentos">
        {celulas.map((dia, i) => {
          if (!dia) return <div key={`v${i}`} />
          const sits = porDia.get(dia) ?? []
          const prevista = previstas.includes(dia) && !sits.length
          const selecionado = diaSelecionado === dia
          const ehHoje = dia === hojeDia
          const tem = sits.length > 0 || prevista
          return (
            <button
              key={dia}
              role="gridcell"
              aria-selected={selecionado}
              aria-label={`Dia ${dia}${sits.length ? `, ${sits.length} conta(s)` : prevista ? ', conta prevista' : ''}`}
              disabled={!tem}
              onClick={() => aoEscolherDia(selecionado ? null : dia)}
              className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition-colors ${selecionado ? 'bg-primaria text-white' : ehHoje ? 'bg-card-hover font-bold ring-2 ring-primaria-sel' : tem ? 'bg-card-hover' : 'text-suave'} disabled:opacity-60`}
            >
              <span>{dia}</span>
              {tem && (
                <span className="flex gap-0.5" aria-hidden>
                  {sits.slice(0, 3).map((s, k) => <span key={k} className="w-2 h-2 rounded-full" style={{ background: COR_SITUACAO[s] }} />)}
                  {prevista && <span className="w-2 h-2 rounded-full border border-current opacity-60" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-suave mt-2">
        {(['vencida', 'breve', 'aberta', 'paga'] as SituacaoConta[]).map((s) => (
          <span key={s} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COR_SITUACAO[s] }} />{NOME_SITUACAO[s]}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block border border-current" />Prevista</span>
      </div>
    </div>
  )
}
