import { useNavigate } from 'react-router-dom'
import { Folha } from '../Folha'
import { api } from '../../api/cliente'
import { useSessao } from '../../store/sessao'
import type { Categoria, Lancamento, Usuario, Cartao } from '../../tipos'
import { dataBr, moeda, nomeCompetencia } from '../../util/formato'
import { Avatar } from './Avatar'
import { ICONE_FORMA, NOME_FORMA } from './ItemLancamento'

const NOME_ORIGEM: Record<string, string> = { manual: 'Digitado', foto: 'Foto do cupom', voz: 'Por voz', sms: 'SMS do banco', email: 'E-mail', fatura: 'Fatura', recorrente: 'Recorrente' }

/**
 * Folha com os detalhes de um lançamento, botão Editar (abre /lancar?editar=ID)
 * e Apagar (soft delete com Desfazer por 5 s).
 */
export function DetalheLancamento({ lancamento, categoria, usuarios, cartoes, aoFechar, aoMudar }: {
  lancamento: Lancamento | null
  categoria?: Categoria
  usuarios: Usuario[]
  cartoes: Cartao[]
  aoFechar: () => void
  aoMudar?: () => void
}) {
  const nav = useNavigate()
  const avisar = useSessao((e) => e.avisar)
  const eu = useSessao((e) => e.boot?.usuario)
  const l = lancamento
  if (!l) return null
  const quem = usuarios.find((u) => u.id === l.usuario_id)
  const cartao = cartoes.find((k) => k.id === l.cartao_id)
  const podeMexer = eu?.perfil !== 'Júnior' || eu.id === l.usuario_id

  async function apagar() {
    if (!l) return
    try {
      await api('excluir_lancamento', { id: l.id })
      aoFechar()
      aoMudar?.()
      avisar('Apagado', {
        tipo: 'ok',
        desfazer: async () => {
          await api('desfazer_exclusao', { id: l.id })
          aoMudar?.()
        },
      })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível apagar', { tipo: 'erro' })
    }
  }

  const linhas: Array<[string, string]> = [
    ['Data', `${dataBr(l.data)} · ${nomeCompetencia(l.competencia)}`],
    ['Categoria', categoria ? `${categoria.icone} ${categoria.nome}` : l.categoria_id],
    ['Pagamento', `${ICONE_FORMA[l.forma_pgto] ?? ''} ${NOME_FORMA[l.forma_pgto] ?? l.forma_pgto}${cartao ? ` · ${cartao.apelido} (final ${cartao.final})` : ''}${l.parcela ? ` · parcela ${l.parcela}` : ''}`],
    ['Origem', NOME_ORIGEM[l.origem] ?? l.origem],
  ]
  if (l.estabelecimento && l.estabelecimento !== l.descricao) linhas.splice(2, 0, ['Estabelecimento', l.estabelecimento])

  return (
    <Folha aberta={!!l} aoFechar={aoFechar} titulo="Detalhes do lançamento">
      <div className="text-center mb-4">
        <div className={`numero-grande !text-3xl ${l.tipo === 'receita' ? 'text-verde' : ''}`}>{l.tipo === 'receita' ? '+' : ''}{moeda(l.valor)}</div>
        <div className="font-semibold text-lg mt-1">{l.descricao || l.estabelecimento || categoria?.nome}</div>
        {l.status === 'a_confirmar' && <span className="inline-block mt-1 rounded-full bg-amarelo/20 text-amarelo px-3 py-0.5 text-sm font-semibold">previsto — ainda não confirmado</span>}
      </div>

      {l.anexo_url && (
        <a href={l.anexo_url} target="_blank" rel="noreferrer" className="block mb-4">
          <img src={l.anexo_url} alt="Comprovante anexado" className="w-full max-h-60 object-contain rounded-xl border border-borda bg-painel" />
          <span className="block text-center text-xs text-suave mt-1">Toque para abrir o comprovante</span>
        </a>
      )}

      <dl className="card divide-y divide-borda mb-4">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-suave text-sm">Quem</dt>
          <dd className="flex items-center gap-2 font-medium"><Avatar usuario={quem} tamanho={28} /> {quem?.apelido ?? '—'}</dd>
        </div>
        {linhas.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="text-suave text-sm shrink-0">{k}</dt>
            <dd className="font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>

      {podeMexer && (
        <div className="grid grid-cols-2 gap-3">
          <button className="botao botao-secundario" onClick={() => { aoFechar(); nav(`/lancar?editar=${l.id}`, { state: { lancamento: l } }) }}>
            <span aria-hidden>✏️</span> Editar
          </button>
          <button className="botao botao-perigo" onClick={apagar}>
            <span aria-hidden>🗑️</span> Apagar
          </button>
        </div>
      )}
    </Folha>
  )
}
