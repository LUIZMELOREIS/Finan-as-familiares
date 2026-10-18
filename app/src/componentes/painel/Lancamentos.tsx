/**
 * Lançamentos em folha: a lista filtrada (fatia/barra/categoria/mês do Painel) e o
 * detalhe de um lançamento com Editar e Apagar (com Desfazer).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lancamento } from '../../tipos'
import { api } from '../../api/cliente'
import { useSessao, categoriaPorId, usuarioPorId } from '../../store/sessao'
import { dataBr, moeda } from '../../util/formato'
import { Avatar } from '../Avatar'
import { Folha } from '../Folha'
import { Icone, corVar } from '../Icone'
import { Carregando, Vazio } from '../Carregando'

export interface FiltroLancamentos {
  titulo: string
  /** Ano inteiro (filtrado no app: a API só filtra por competência). */
  ano?: number
  competencia?: string
  categoria_id?: string
  grupo_analise?: string
  tipo_id?: string
  usuario_id_filtro?: string
}

const FORMAS: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', 'débito': 'Débito', 'crédito': 'Crédito', boleto: 'Boleto' }
const ORIGENS: Record<string, string> = { manual: 'Digitado', foto: 'Foto do cupom', voz: 'Voz', chat: 'Assistente', sms: 'SMS do banco', email: 'E-mail', fatura: 'Fatura', recorrente: 'Recorrente', telegram: 'Telegram' }

/** Uma linha de lançamento (data, descrição, quem, forma, valor e miniatura do anexo). */
export function LinhaLancamento({ l, aoClicar }: { l: Lancamento; aoClicar: (l: Lancamento) => void }) {
  const boot = useSessao((e) => e.boot)
  const cat = categoriaPorId(boot?.categorias ?? [], l.categoria_id)
  const quem = usuarioPorId(boot?.usuarios ?? [], l.usuario_id)
  const mini = l.anexo_miniatura || (l.anexo_url && /^(data:image|blob:)/.test(l.anexo_url) ? l.anexo_url : '')
  return (
    <button type="button" className="row" onClick={() => aoClicar(l)} style={{ minHeight: 44 }}>
      {mini
        ? <img src={mini} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
        : <span className="ico-sm" style={{ color: corVar(cat?.cor) }}><Icone nome={cat?.icone ?? 'receipt'} tamanho={16} /></span>}
      <span className="t">
        <b>{l.descricao || l.estabelecimento || cat?.nome || 'Lançamento'}</b>
        <small className="num">{dataBr(l.data)} · {FORMAS[l.forma_pgto] ?? l.forma_pgto}{l.parcela ? ` · ${l.parcela}` : ''}{cat && !l.descricao ? '' : cat ? ` · ${cat.nome}` : ''}</small>
      </span>
      <Avatar usuario={quem} tamanho={24} />
      {l.anexo_url && !mini && <Icone nome="paperclip" tamanho={14} style={{ color: 'var(--muted)' }} />}
      <span className="amt num" style={l.tipo === 'receita' ? { color: 'var(--green)' } : undefined}>{l.tipo === 'receita' ? '+' : ''}{moeda(l.valor)}</span>
    </button>
  )
}

/** Folha com a lista de lançamentos de um filtro; toque abre a edição em /lancar. */
export function FolhaLancamentos({ filtro, aoFechar }: { filtro: FiltroLancamentos | null; aoFechar: () => void }) {
  const nav = useNavigate()
  const [itens, setItens] = useState<Lancamento[] | null>(null)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null)

  useEffect(() => {
    if (!filtro) return
    let vivo = true
    setItens(null); setErro('')
    const params: Record<string, unknown> = { ...filtro }
    delete params.titulo
    delete params.ano
    api<Lancamento[]>('listar_lancamentos', params)
      .then((r) => { if (vivo) setItens(filtro.ano ? r.filter((l) => l.competencia.startsWith(String(filtro.ano))) : r) })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar') })
    return () => { vivo = false }
  }, [filtro])

  const total = (itens ?? []).reduce((s, l) => s + l.valor, 0)
  const abrir = (l: Lancamento) => setDetalhe(l)
  const editar = (l: Lancamento) => { aoFechar(); nav(`/lancar?editar=${encodeURIComponent(l.id)}`, { state: { lancamento: l } }) }

  return (
    <>
      <Folha aberta={!!filtro && !detalhe} aoFechar={aoFechar} titulo={filtro?.titulo}>
        {erro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</p>}
        {!erro && itens === null && <Carregando />}
        {itens && itens.length === 0 && <Vazio icone="receipt" titulo="Nenhum lançamento" texto="Não há lançamentos para este filtro." />}
        {itens && itens.length > 0 && (
          <>
            <p className="sub num" style={{ margin: '0 0 6px' }}>{itens.length} lançamento{itens.length > 1 ? 's' : ''} · {moeda(total)}</p>
            <div className="rows">{itens.map((l) => <LinhaLancamento key={l.id} l={l} aoClicar={abrir} />)}</div>
          </>
        )}
      </Folha>
      <FolhaLancamento
        lancamento={detalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={editar}
        aoApagar={(id) => { setItens((xs) => (xs ? xs.filter((x) => x.id !== id) : xs)); setDetalhe(null) }}
        aoRestaurar={(l) => setItens((xs) => (xs ? [l, ...xs].sort((a, b) => (a.data < b.data ? 1 : -1)) : xs))}
      />
    </>
  )
}

/** Folha de detalhe de um lançamento: Editar (/lancar?editar=ID) e Apagar (com Desfazer). */
export function FolhaLancamento({ lancamento, aoFechar, aoEditar, aoApagar, aoRestaurar }: {
  lancamento: Lancamento | null
  aoFechar: () => void
  aoEditar: (l: Lancamento) => void
  aoApagar: (id: string) => void
  aoRestaurar?: (l: Lancamento) => void
}) {
  const boot = useSessao((e) => e.boot)
  const avisar = useSessao((e) => e.avisar)
  const [apagando, setApagando] = useState(false)
  if (!lancamento) return null
  const l = lancamento
  const cat = categoriaPorId(boot?.categorias ?? [], l.categoria_id)
  const quem = usuarioPorId(boot?.usuarios ?? [], l.usuario_id)
  const euMesmo = boot?.usuario.id === l.usuario_id
  const podeApagar = boot?.usuario.perfil !== 'Dependente' || euMesmo
  const ehImagem = !!l.anexo_url && (/^(data:image|blob:)/.test(l.anexo_url) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(l.anexo_url))

  const apagar = async () => {
    setApagando(true)
    try {
      await api('excluir_lancamento', { id: l.id })
      aoApagar(l.id)
      avisar('Lançamento apagado.', {
        tipo: 'ok',
        desfazer: async () => {
          const r = await api<Lancamento>('desfazer_exclusao', { id: l.id })
          aoRestaurar?.(r)
        },
      })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível apagar', { tipo: 'erro' })
    } finally {
      setApagando(false)
    }
  }

  const Campo = ({ r, v }: { r: string; v?: string }) => v ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{r}</span><span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  ) : null

  return (
    <Folha aberta={!!lancamento} aoFechar={aoFechar} titulo="Lançamento">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <span className="ico" style={{ ['--c' as string]: corVar(cat?.cor) }}><Icone nome={cat?.icone ?? 'receipt'} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{l.descricao || l.estabelecimento || cat?.nome}</div>
          <div className="sub">{cat?.nome}{l.status === 'a_confirmar' ? ' · a confirmar' : ''}</div>
        </div>
        <div className="num" style={{ fontSize: 20, fontWeight: 600, color: l.tipo === 'receita' ? 'var(--green)' : undefined }}>{moeda(l.valor)}</div>
      </div>
      <Campo r="Data" v={dataBr(l.data)} />
      <Campo r="Quem lançou" v={quem?.apelido} />
      <Campo r="Forma de pagamento" v={FORMAS[l.forma_pgto] ?? l.forma_pgto} />
      <Campo r="Estabelecimento" v={l.estabelecimento} />
      <Campo r="Parcela" v={l.parcela} />
      <Campo r="Origem" v={ORIGENS[l.origem] ?? l.origem} />
      {l.anexo_url && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          {ehImagem
            ? <a href={l.anexo_url} target="_blank" rel="noreferrer"><img src={l.anexo_url} alt="Comprovante" style={{ maxHeight: 220, borderRadius: 10, display: 'block', margin: '0 auto' }} /></a>
            : <a className="btn btn-ghost btn-sm" href={l.anexo_url} target="_blank" rel="noreferrer"><Icone nome="paperclip" />Abrir comprovante</a>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => aoEditar(l)}><Icone nome="pencil" />Editar</button>
        {podeApagar && <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={apagar} disabled={apagando}><Icone nome="trash-2" />Apagar</button>}
      </div>
    </Folha>
  )
}
