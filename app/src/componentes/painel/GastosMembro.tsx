import type { Usuario } from '../../tipos'
import { moeda, porcentagem } from '../../util/formato'
import { Avatar } from '../inicio/Avatar'
import { CartaoPainel } from './tema'

/** "Gastos por membro": barras horizontais com avatar, no mês selecionado. */
export function GastosMembro({ usuarios, porUsuario, aoTocar }: { usuarios: Usuario[]; porUsuario: Record<string, number>; aoTocar: (usuarioId: string) => void }) {
  const linhas = usuarios
    .map((u) => ({ u, valor: porUsuario[u.id] ?? 0 }))
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  const maior = linhas[0]?.valor ?? 0
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  return (
    <CartaoPainel titulo="Gastos por membro" subtitulo="Quem lançou cada gasto no mês">
      {linhas.length === 0 ? <div className="text-sm text-suave py-6 text-center">Sem gastos no mês.</div> : (
        <ul className="space-y-2">
          {linhas.map(({ u, valor }) => (
            <li key={u.id}>
              <button type="button" className="w-full flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-card-hover text-left" onClick={() => aoTocar(u.id)} aria-label={`${u.apelido}: ${moeda(valor)} (${porcentagem(valor, total)}% do mês). Ver lançamentos`}>
                <Avatar usuario={u} tamanho={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold truncate">{u.apelido}</span>
                    <span className="tabular-nums">{moeda(valor)} <span className="text-xs text-suave">· {porcentagem(valor, total)}%</span></span>
                  </div>
                  <div className="progresso mt-1" aria-hidden>
                    <span style={{ width: `${maior ? (valor / maior) * 100 : 0}%`, background: u.cor }} />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </CartaoPainel>
  )
}
