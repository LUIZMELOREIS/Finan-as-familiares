/**
 * Um gasto capturado (SMS, e-mail ou fatura): "R$ 87,40 · PADARIA PAO QUENTE —
 * qual é a despesa?" com os chips do cardápio e a sugestão já marcada.
 */
import type { CanalCaixa, Cartao, Categoria, ItemCaixaEntrada, Usuario } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'
import { Avatar } from '../Avatar'
import { Icone } from '../Icone'
import { Chip } from '../lancar/Cardapio'
import { estiloCor } from '../lancar/comuns'

const CANAL: Record<CanalCaixa, { icone: string; nome: string }> = {
  sms_ios: { icone: 'smartphone', nome: 'SMS' }, sms_android: { icone: 'smartphone', nome: 'SMS' }, email: { icone: 'mail', nome: 'E-mail' }, fatura: { icone: 'receipt', nome: 'Fatura' },
}
const STATUS_TAG: Record<string, { classe: string; nome: string }> = {
  'lançado': { classe: 'ok', nome: 'lançado' }, ignorado: { classe: 'proj', nome: 'ignorado' }, duplicado: { classe: 'warn', nome: 'duplicado' },
}

export function CartaoCaixa({ item, categorias, cartoes, usuarios, saindo, ocupado, aoResolver, aoOutras, aoIgnorar }: {
  item: ItemCaixaEntrada
  categorias: Categoria[]
  cartoes: Cartao[]
  usuarios: Usuario[]
  saindo?: boolean
  ocupado?: boolean
  aoResolver?: (categoriaId: string) => void
  aoOutras?: () => void
  aoIgnorar?: () => void
}) {
  const pendente = item.status === 'pendente'
  const canal = CANAL[item.canal] ?? CANAL.email
  const cartao = cartoes.find((k) => k.final === item.final_cartao)
  const quem = usuarios.find((u) => u.id === item.usuario_id)
  const sugestoes = [...new Set([item.sugestao_categoria, ...item.sugestoes])].map((id) => categorias.find((c) => c.id === id)).filter((c): c is Categoria => !!c)
  const tag = STATUS_TAG[item.status]

  return (
    <div className="card" style={{ transition: 'opacity .25s ease, transform .25s ease', opacity: saindo ? 0 : 1, transform: saindo ? 'translateX(24px)' : 'none' }} aria-busy={ocupado}>
      <div className="flex items-baseline flex-wrap" style={{ gap: '0 8px', fontSize: 13.5 }}>
        <b className="num" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(item.valor)}</b>
        <span style={{ color: 'var(--muted)' }}>·</span>
        <span style={{ fontWeight: 500 }}>{item.estabelecimento}</span>
        {pendente ? <span style={{ color: 'var(--muted)' }}>— qual é a despesa?</span> : tag && <span className={`tag ${tag.classe}`}>{tag.nome}</span>}
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: '4px 12px', fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
        <span className="num">{dataBr(item.data_compra)}</span>
        <span className="flex items-center" style={{ gap: 5 }}><Icone nome={canal.icone} tamanho={13} />{canal.nome}</span>
        {(cartao || item.final_cartao) && <span className="flex items-center num" style={{ gap: 5 }}><Icone nome="credit-card" tamanho={13} />{cartao ? `${cartao.apelido} · final ${cartao.final}` : `final ${item.final_cartao}`}</span>}
        {quem && <span className="flex items-center" style={{ gap: 5 }}><Avatar usuario={quem} tamanho={18} />{quem.apelido}</span>}
      </div>
      {pendente && (
        <>
          <div className="chips" style={{ marginTop: 10 }}>
            {sugestoes.map((c) => <Chip key={c.id} categoria={c} escolhida={c.id === item.sugestao_categoria} aoEscolher={(cat) => aoResolver?.(cat.id)} />)}
            <button type="button" className="chip" style={estiloCor('slate')} onClick={aoOutras} aria-label="Outras categorias"><Icone nome="more-horizontal" tamanho={17} /><span>Outras…</span></button>
          </div>
          <div className="flex justify-end" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={aoIgnorar} disabled={ocupado}><Icone nome="x" />Ignorar</button>
          </div>
        </>
      )}
    </div>
  )
}
