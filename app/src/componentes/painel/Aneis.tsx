import { moeda } from '../../util/formato'
import { CartaoPainel } from './tema'

export interface Anel { id: string; nome: string; valor: number; pct: number; cor: string }

/** Anel pequeno em SVG próprio (leve e nítido). */
function AnelSvg({ pct, cor, tamanho = 76 }: { pct: number; cor: string; tamanho?: number }) {
  const esp = 8
  const r = (tamanho - esp) / 2
  const c = 2 * Math.PI * r
  const cheio = Math.max(0, Math.min(100, pct)) / 100
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(169,170,184,0.18)" strokeWidth={esp} />
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={esp} strokeLinecap="round" strokeDasharray={`${c * cheio} ${c * (1 - cheio)}`} transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor">{Math.round(pct)}%</text>
    </svg>
  )
}

/** "Participação na base anual": fileira rolável de anéis por subgrupo. */
export function Aneis({ aneis, aoTocar }: { aneis: Anel[]; aoTocar: (a: Anel) => void }) {
  return (
    <CartaoPainel titulo="Participação na base anual" subtitulo="Quanto cada área pesa nas despesas do ano">
      {aneis.length === 0 ? <div className="text-sm text-suave py-6 text-center">Sem despesas no ano.</div> : (
        <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-2 px-2 pb-1">
          {aneis.map((a) => (
            <button key={a.id} type="button" className="shrink-0 w-28 flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-card-hover text-center" onClick={() => aoTocar(a)} aria-label={`${a.nome}: ${Math.round(a.pct)}% das despesas do ano, ${moeda(a.valor)}. Ver lançamentos`}>
              <AnelSvg pct={a.pct} cor={a.cor} />
              <span className="text-xs font-semibold leading-tight line-clamp-2">{a.nome}</span>
              <span className="text-[11px] text-suave tabular-nums">{moeda(a.valor)}</span>
            </button>
          ))}
        </div>
      )}
    </CartaoPainel>
  )
}
