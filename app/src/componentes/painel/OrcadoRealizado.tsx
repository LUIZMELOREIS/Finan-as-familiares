import type { Categoria } from '../../tipos'
import { moeda, porcentagem } from '../../util/formato'
import { CartaoPainel } from './tema'

export interface LinhaOrcamento { categoria: Categoria; orcado: number; realizado: number }

/** "Orçado × realizado" por categoria do mês: a barra fica vermelha ao estourar. */
export function OrcadoRealizado({ linhas, aoTocar }: { linhas: LinhaOrcamento[]; aoTocar: (categoriaId: string) => void }) {
  const ordenadas = [...linhas].sort((a, b) => porcentagem(b.realizado, b.orcado) - porcentagem(a.realizado, a.orcado))
  const estouradas = ordenadas.filter((l) => l.realizado > l.orcado).length
  return (
    <CartaoPainel titulo="Orçado × realizado" subtitulo={estouradas ? `${estouradas} ${estouradas === 1 ? 'categoria passou' : 'categorias passaram'} do planejado` : 'Tudo dentro do planejado'}>
      {ordenadas.length === 0 ? <div className="text-sm text-suave py-6 text-center">Nenhum orçamento definido para este mês.</div> : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1" aria-label="Categorias com orçamento">
          {ordenadas.map(({ categoria: c, orcado, realizado }) => {
            const pct = porcentagem(realizado, orcado)
            const estourou = realizado > orcado
            return (
              <li key={c.id}>
                <button type="button" className="w-full text-left rounded-lg px-1 py-1 hover:bg-card-hover" onClick={() => aoTocar(c.id)} aria-label={`${c.nome}: ${moeda(realizado)} de ${moeda(orcado)} (${pct}%). Ver lançamentos`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{c.icone}</span>
                    <span className="flex-1 truncate">{c.nome}</span>
                    <span className={`tabular-nums font-semibold ${estourou ? 'text-vermelho' : ''}`}>{moeda(realizado)}</span>
                    <span className="text-xs text-suave tabular-nums">/ {moeda(orcado)}</span>
                  </div>
                  <div className="progresso mt-1" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${Math.min(100, pct)}%`, background: estourou ? 'var(--vermelho)' : c.cor }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </CartaoPainel>
  )
}
