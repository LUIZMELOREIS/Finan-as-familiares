/** Calendário simples do mês (grade de 7 colunas) com pontos coloridos por situação da conta. */
import type { ContaAPagar } from '../../tipos'
import { hojeIso } from '../../util/formato'
import { diasAte } from '../lancar/comuns'

export type Situacao = 'paga' | 'vencida' | 'breve' | 'aberta'

export function situacaoDe(c: ContaAPagar, hoje = hojeIso()): Situacao {
  if (c.status === 'paga') return 'paga'
  if (c.vencimento < hoje) return 'vencida'
  return diasAte(c.vencimento) <= 3 ? 'breve' : 'aberta'
}

export const COR_SITUACAO: Record<Situacao, string> = { vencida: 'var(--red)', breve: 'var(--gold)', aberta: 'var(--indigo)', paga: 'var(--green)' }
export const TAG_SITUACAO: Record<Situacao, string> = { vencida: 'red', breve: 'warn', aberta: 'proj', paga: 'ok' }
export const NOME_SITUACAO: Record<Situacao, string> = { vencida: 'Vencida', breve: 'Vence em 3 dias', aberta: 'Em aberto', paga: 'Paga' }

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function Calendario({ competencia, contas, diaSelecionado, aoEscolherDia }: {
  competencia: string
  contas: ContaAPagar[]
  diaSelecionado: number | null
  aoEscolherDia: (dia: number | null) => void
}) {
  const [ano, mes] = competencia.split('-').map(Number)
  const primeiro = new Date(ano, mes - 1, 1).getDay()
  const total = new Date(ano, mes, 0).getDate()
  const hoje = hojeIso()
  const hojeDia = hoje.slice(0, 7) === competencia ? Number(hoje.slice(8, 10)) : -1
  const porDia = new Map<number, Situacao[]>()
  for (const c of contas) {
    if (!c.vencimento.startsWith(competencia)) continue
    const d = Number(c.vencimento.slice(8, 10))
    porDia.set(d, [...(porDia.get(d) ?? []), situacaoDe(c, hoje)])
  }
  const celulas: Array<number | null> = [...Array<null>(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 10.5, color: 'var(--faint)', marginBottom: 4 }} aria-hidden="true">
        {DIAS_SEMANA.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }} role="grid" aria-label="Calendário de vencimentos">
        {celulas.map((dia, i) => {
          if (!dia) return <div key={`v${i}`} />
          const sits = porDia.get(dia) ?? []
          const tem = sits.length > 0
          const selecionado = diaSelecionado === dia
          const ehHoje = dia === hojeDia
          return (
            <button
              key={dia}
              type="button"
              role="gridcell"
              aria-selected={selecionado}
              aria-label={`Dia ${dia}${tem ? `, ${sits.length} conta${sits.length === 1 ? '' : 's'}` : ''}`}
              disabled={!tem}
              onClick={() => aoEscolherDia(selecionado ? null : dia)}
              className="num"
              style={{
                height: 40, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 12.5,
                background: selecionado ? 'var(--sel)' : tem ? 'var(--card-2)' : 'transparent',
                color: selecionado ? '#fff' : tem ? 'var(--text)' : 'var(--faint)',
                boxShadow: ehHoje && !selecionado ? 'inset 0 0 0 1px var(--sel)' : undefined,
                fontWeight: ehHoje ? 600 : 400, opacity: 1,
              }}
            >
              <span>{dia}</span>
              {tem && <span className="flex" style={{ gap: 2 }} aria-hidden="true">{sits.slice(0, 3).map((s, k) => <span key={k} style={{ width: 5, height: 5, borderRadius: 3, background: selecionado ? '#fff' : COR_SITUACAO[s] }} />)}</span>}
            </button>
          )
        })}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {(['vencida', 'breve', 'aberta', 'paga'] as Situacao[]).map((s) => <span key={s}><i style={{ background: COR_SITUACAO[s], borderRadius: 5 }} />{NOME_SITUACAO[s]}</span>)}
      </div>
    </div>
  )
}
