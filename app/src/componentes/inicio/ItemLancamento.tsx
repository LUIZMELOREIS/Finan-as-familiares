import type { Categoria, Lancamento, Usuario } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'
import { Avatar } from './Avatar'

export const NOME_FORMA: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', 'débito': 'Débito', 'crédito': 'Crédito', boleto: 'Boleto' }
export const ICONE_FORMA: Record<string, string> = { dinheiro: '💵', pix: '⚡', 'débito': '💳', 'crédito': '💳', boleto: '🧾' }

/** Uma linha de lançamento: data, descrição, quem, forma de pagamento, miniatura do anexo. */
export function ItemLancamento({ lancamento, categoria, usuario, aoTocar, mostrarCategoria }: {
  lancamento: Lancamento
  categoria?: Categoria
  usuario?: Usuario
  aoTocar?: (l: Lancamento) => void
  mostrarCategoria?: boolean
}) {
  const l = lancamento
  const previsto = l.status === 'a_confirmar'
  const Tag = aoTocar ? 'button' : 'div'
  return (
    <Tag
      className={`w-full text-left flex items-center gap-3 px-3 py-3 min-h-16 border-b border-borda last:border-b-0 ${aoTocar ? 'hover:bg-card-hover active:bg-card-hover' : ''} ${previsto ? 'opacity-80' : ''}`}
      onClick={aoTocar ? () => aoTocar(l) : undefined}
      aria-label={aoTocar ? `${l.descricao || l.estabelecimento || categoria?.nome}, ${moeda(l.valor)}, ${dataBr(l.data)}. Toque para ver detalhes` : undefined}
    >
      {l.anexo_url ? (
        <img src={l.anexo_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-borda" />
      ) : (
        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: `color-mix(in srgb, ${categoria?.cor ?? 'var(--primaria)'} 22%, transparent)` }} aria-hidden>{categoria?.icone ?? '🧾'}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          {l.descricao || l.estabelecimento || categoria?.nome || 'Lançamento'}
          {l.parcela && <span className="text-suave font-normal"> · {l.parcela}</span>}
        </div>
        <div className="text-xs text-suave flex items-center gap-1.5 flex-wrap">
          <span>{dataBr(l.data)}</span>
          {mostrarCategoria && categoria && <span>· {categoria.nome}</span>}
          <span>· {ICONE_FORMA[l.forma_pgto]} {NOME_FORMA[l.forma_pgto] ?? l.forma_pgto}</span>
          {previsto && <span className="rounded-full bg-amarelo/20 text-amarelo px-2 py-0.5 font-semibold">previsto</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-bold tabular-nums ${l.tipo === 'receita' ? 'text-verde' : ''}`}>{l.tipo === 'receita' ? '+' : ''}{moeda(l.valor)}</div>
        <div className="flex justify-end mt-0.5"><Avatar usuario={usuario} tamanho={22} /></div>
      </div>
    </Tag>
  )
}
