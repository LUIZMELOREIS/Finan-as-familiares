import { Link } from 'react-router-dom'
import type { ContaAPagar, ContaFixa } from '../../tipos'
import { dataBr, hojeIso, moeda } from '../../util/formato'

function diasAte(iso: string) {
  const hoje = new Date(hojeIso() + 'T00:00:00').getTime()
  const alvo = new Date(iso.slice(0, 10) + 'T00:00:00').getTime()
  return Math.round((alvo - hoje) / 86_400_000)
}

/** Linha rolável com as contas que vencem nos próximos 7 dias. */
export function ContasAVencer({ contas, contasFixas }: { contas: ContaAPagar[]; contasFixas: ContaFixa[] }) {
  const proximas = contas
    .filter((c) => c.status === 'aberta')
    .map((c) => ({ c, dias: diasAte(c.vencimento) }))
    .filter(({ dias }) => dias <= 7)
    .sort((a, b) => a.dias - b.dias)
  if (!proximas.length) return null
  const nomeDe = (c: ContaAPagar) => contasFixas.find((f) => f.id === c.conta_fixa_id)?.nome ?? 'Conta'

  return (
    <section aria-label="Contas a vencer">
      <div className="flex items-center justify-between mb-2">
        <h2 className="titulo-secao">Vencem nos próximos dias</h2>
        <Link to="/contas" className="text-sm font-semibold text-primaria-sel">Ver todas ›</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto rolagem-escondida -mx-4 px-4 pb-1">
        {proximas.map(({ c, dias }) => {
          const atrasada = dias < 0
          const quando = atrasada ? `Venceu há ${-dias} dia${dias === -1 ? '' : 's'}` : dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`
          return (
            <Link key={c.id} to="/contas" className={`card card-toque shrink-0 w-44 p-3 border-t-4 ${atrasada ? 'border-t-vermelho' : dias <= 1 ? 'border-t-amarelo' : 'border-t-primaria'}`} aria-label={`${nomeDe(c)}, ${moeda(c.valor)}, ${quando}`}>
              <div className="font-semibold truncate">{nomeDe(c)}</div>
              <div className="font-extrabold text-lg tabular-nums">{moeda(c.valor)}</div>
              <div className={`text-xs mt-1 ${atrasada ? 'text-vermelho font-semibold' : 'text-suave'}`}>📅 {quando} · {dataBr(c.vencimento)}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
