/**
 * Um gasto capturado (SMS, e-mail ou fatura): "R$ 87,40 · PADARIA PAO QUENTE —
 * qual é a despesa?" com os chips do cardápio e a sugestão já marcada.
 */
import type { CanalCaixa, Cartao, Categoria, DestinoNota, ItemCaixaEntrada, Usuario } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'
import { Avatar } from '../Avatar'
import { Icone } from '../Icone'
import { Chip } from '../lancar/Cardapio'
import { estiloCor } from '../lancar/comuns'

const CANAL: Record<CanalCaixa, { icone: string; nome: string }> = {
  sms_ios: { icone: 'smartphone', nome: 'SMS' }, sms_android: { icone: 'smartphone', nome: 'SMS' }, email: { icone: 'mail', nome: 'E-mail' }, fatura: { icone: 'receipt', nome: 'Fatura' },
  nota_parana: { icone: 'receipt', nome: 'Nota Paraná' }, nota_curitibana: { icone: 'receipt', nome: 'Nota Curitibana' },
}
const STATUS_TAG: Record<string, { classe: string; nome: string }> = {
  'lançado': { classe: 'ok', nome: 'lançado' }, ignorado: { classe: 'proj', nome: 'ignorado' }, duplicado: { classe: 'warn', nome: 'duplicado' }, aguardando_nota: { classe: 'warn', nome: 'aguardando a nota' },
}
const DESTINO_NOME: Record<string, string> = { familia: 'família', empresa: 'empresa', ignorar: 'ignorada' }

export function CartaoCaixa({ item, categorias, cartoes, usuarios, saindo, ocupado, aoResolver, aoOutras, aoIgnorar, aoDestino }: {
  item: ItemCaixaEntrada
  categorias: Categoria[]
  cartoes: Cartao[]
  usuarios: Usuario[]
  saindo?: boolean
  ocupado?: boolean
  aoResolver?: (categoriaId: string) => void
  aoOutras?: () => void
  aoIgnorar?: () => void
  /** Nota fiscal: Família (lança) · Empresa · Ignorar — aprende para o CNPJ. */
  aoDestino?: (destino: DestinoNota) => void
}) {
  const pendente = item.status === 'pendente'
  const aguardando = item.status === 'aguardando_nota'
  const nota = item.nota
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
        {pendente ? <span style={{ color: 'var(--muted)' }}>{nota && nota.destino === 'a_confirmar' ? '— Família ou Empresa?' : '— qual é a despesa?'}</span> : tag && <span className={`tag ${tag.classe}`}>{tag.nome}</span>}
        {!pendente && nota?.destino && DESTINO_NOME[nota.destino] && <span className="tag proj">{DESTINO_NOME[nota.destino]}</span>}
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: '4px 12px', fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
        <span className="num">{dataBr(item.data_compra)}</span>
        <span className="flex items-center" style={{ gap: 5 }}><Icone nome={canal.icone} tamanho={13} />{canal.nome}</span>
        {(cartao || item.final_cartao) && <span className="flex items-center num" style={{ gap: 5 }}><Icone nome="credit-card" tamanho={13} />{cartao ? `${cartao.apelido} · final ${cartao.final}` : `final ${item.final_cartao}`}</span>}
        {quem && <span className="flex items-center" style={{ gap: 5 }}><Avatar usuario={quem} tamanho={18} />{quem.apelido}</span>}
        {nota && nota.qtd_itens > 0 && <span className="num">{nota.qtd_itens} {nota.qtd_itens === 1 ? 'item' : 'itens'}</span>}
        {nota && nota.chave_final && <span className="num" title="8 últimos dígitos da chave de acesso">nota …{nota.chave_final}</span>}
      </div>
      {nota && nota.itens.length > 0 && (
        <details style={{ marginTop: 6, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Ver itens da nota</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--muted)' }}>
            {nota.itens.slice(0, 12).map((i, k) => <li key={k}><span>{i.d}</span> <span className="num">{i.q > 1 ? `${i.q}× ` : ''}{moeda(i.vt)}</span></li>)}
            {nota.itens.length > 12 && <li>… e mais {nota.itens.length - 12}</li>}
          </ul>
        </details>
      )}
      {aguardando && (
        <div className="flex items-center justify-between flex-wrap" style={{ marginTop: 8, gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
          <span>A nota ainda não apareceu no portal. O robô procura de novo às 21h.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={aoIgnorar} disabled={ocupado}><Icone nome="x" />Cancelar espera</button>
        </div>
      )}
      {pendente && (
        <>
          <div className="chips" style={{ marginTop: 10 }}>
            {sugestoes.map((c) => <Chip key={c.id} categoria={c} escolhida={c.id === item.sugestao_categoria} aoEscolher={(cat) => aoResolver?.(cat.id)} />)}
            <button type="button" className="chip" style={estiloCor('slate')} onClick={aoOutras} aria-label="Outras categorias"><Icone nome="more-horizontal" tamanho={17} /><span>Outras…</span></button>
          </div>
          <div className="flex justify-end flex-wrap" style={{ marginTop: 8, gap: 6 }}>
            {nota && aoDestino && <button type="button" className="btn btn-ghost btn-sm" onClick={() => aoDestino('empresa')} disabled={ocupado} title="Compra da empresa: sai do painel da casa e a loja fica aprendida"><Icone nome="briefcase" />Empresa</button>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (nota && aoDestino ? aoDestino('ignorar') : aoIgnorar?.())} disabled={ocupado}><Icone nome="x" />Ignorar</button>
          </div>
        </>
      )}
    </div>
  )
}
