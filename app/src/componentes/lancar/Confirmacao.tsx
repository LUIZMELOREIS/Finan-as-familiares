import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Cartao, Categoria, FormaPgto, Grupo, Usuario } from '../../tipos'
import { lerValor, moeda, numero } from '../../util/formato'
import { Avatar } from '../inicio/Avatar'
import { FolhaCategorias } from './FolhaCategorias'
import type { Rascunho } from './rascunho'

const FORMAS: Array<{ id: FormaPgto; nome: string; icone: string }> = [
  { id: 'dinheiro', nome: 'Dinheiro', icone: '💵' },
  { id: 'pix', nome: 'Pix', icone: '⚡' },
  { id: 'débito', nome: 'Débito', icone: '💳' },
  { id: 'crédito', nome: 'Crédito', icone: '💳' },
  { id: 'boleto', nome: 'Boleto', icone: '🧾' },
]

/** Valor grande que vira campo de texto ao tocar. */
function ValorEditavel({ valor, aoMudar, tipo }: { valor: number; aoMudar: (v: number) => void; tipo: Rascunho['tipo'] }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  if (editando) {
    return (
      <input
        className="campo text-center !text-4xl font-extrabold !min-h-20 tabular-nums"
        inputMode="decimal"
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => { aoMudar(lerValor(texto)); setEditando(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        aria-label="Valor em reais"
      />
    )
  }
  return (
    <button type="button" className="w-full text-center py-2 rounded-2xl hover:bg-card-hover" onClick={() => { setTexto(valor ? numero(valor) : ''); setEditando(true) }} aria-label={`Valor ${moeda(valor)}. Toque para editar`}>
      <div className={`font-extrabold text-5xl tabular-nums tracking-tight ${tipo === 'receita' ? 'text-verde' : ''} ${valor ? '' : 'text-vermelho'}`}>{moeda(valor)}</div>
      <div className="text-xs text-primaria-sel font-semibold mt-1"><span aria-hidden>✏️</span> toque para editar</div>
    </button>
  )
}

/**
 * Tela de confirmação, comum aos três modos (foto, voz, digitação).
 * Botão enorme "Confirmar" no final.
 */
export function Confirmacao({ rascunho, aoMudar, categorias, grupos, cartoes, usuarios, usuarioAtual, valorGastoGrande, salvando, editando, aoConfirmar, aoVoltar }: {
  rascunho: Rascunho
  aoMudar: (r: Partial<Rascunho>) => void
  categorias: Categoria[]
  grupos: Grupo[]
  cartoes: Cartao[]
  usuarios: Usuario[]
  usuarioAtual: Usuario
  valorGastoGrande: number
  salvando: boolean
  editando: boolean
  aoConfirmar: () => void
  aoVoltar: () => void
}) {
  const r = rascunho
  const [folhaCategorias, setFolhaCategorias] = useState(false)
  const categoria = categorias.find((c) => c.id === r.categoria_id)
  const ehJunior = usuarioAtual.perfil === 'Júnior'
  const cartoesAtivos = cartoes.filter((k) => k.ativo)
  const gastoGrande = r.tipo === 'despesa' && valorGastoGrande > 0 && r.valor >= valorGastoGrande
  const pronto = r.valor > 0 && !!r.categoria_id && (r.forma_pgto !== 'crédito' || !!r.cartao_id || cartoesAtivos.length === 0)

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="card p-3">
        <ValorEditavel valor={r.valor} aoMudar={(v) => aoMudar({ valor: v })} tipo={r.tipo} />
        {!r.id && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-painel border border-borda mt-1" role="radiogroup" aria-label="Tipo">
            {(['despesa', 'receita'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={r.tipo === t} onClick={() => aoMudar({ tipo: t, categoria_id: r.tipo === t ? r.categoria_id : '' })}
                className={`botao !min-h-11 !rounded-lg text-sm ${r.tipo === t ? (t === 'despesa' ? 'bg-vermelho text-white' : 'bg-verde text-white') : 'botao-fantasma'}`}>
                {t === 'despesa' ? '🛒 Despesa' : '💰 Entrada'}
              </button>
            ))}
          </div>
        )}
      </div>

      {gastoGrande && (
        <div className="card p-3 border-amarelo/70 bg-amarelo/10 text-sm flex gap-2 items-start">
          <span className="text-xl" aria-hidden>🤝</span>
          <div>
            <b>Gasto grande:</b> que tal levar ao Conselho da Família? <Link to="/conselho" className="font-semibold text-primaria-sel underline">Abrir o Conselho</Link>
            <div className="text-suave text-xs mt-0.5">Você pode confirmar mesmo assim.</div>
          </div>
        </div>
      )}

      {/* Categoria */}
      <div>
        <span className="rotulo">Categoria</span>
        <button type="button" className={`botao w-full justify-start !min-h-14 ${categoria ? 'botao-secundario' : 'botao-amarelo'}`} onClick={() => setFolhaCategorias(true)} aria-label={categoria ? `Categoria ${categoria.nome}. Toque para trocar` : 'Escolher categoria'}>
          <span className="text-2xl" aria-hidden>{categoria?.icone ?? '❓'}</span>
          <span className="flex-1 text-left">{categoria?.nome ?? 'Escolha a categoria'}</span>
          <span className="text-sm opacity-80">trocar ›</span>
        </button>
      </div>

      {/* Descrição e data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="rotulo">Descrição <span className="opacity-70">(opcional)</span></span>
          <input className="campo" value={r.descricao} onChange={(e) => aoMudar({ descricao: e.target.value })} placeholder={categoria ? `Ex.: ${categoria.nome}` : 'Ex.: Padaria'} />
        </label>
        <label className="block">
          <span className="rotulo">Data</span>
          <input className="campo" type="date" value={r.data} onChange={(e) => aoMudar({ data: e.target.value || r.data })} />
        </label>
      </div>

      {/* Forma de pagamento */}
      <div>
        <span className="rotulo">{r.tipo === 'despesa' ? 'Como pagou?' : 'Como recebeu?'}</span>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Forma de pagamento">
          {FORMAS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={r.forma_pgto === f.id} onClick={() => aoMudar({ forma_pgto: f.id, cartao_id: f.id === 'crédito' ? (r.cartao_id || cartoesAtivos.find((k) => k.titular_id === r.usuario_id)?.id || cartoesAtivos[0]?.id) : r.cartao_id })}
              className={`botao flex-col gap-0.5 !px-1 !min-h-16 !rounded-xl ${r.forma_pgto === f.id ? 'bg-primaria-sel text-white' : 'botao-secundario'}`}>
              <span className="text-xl" aria-hidden>{f.icone}</span>
              <span className="text-xs font-semibold">{f.nome}</span>
            </button>
          ))}
        </div>
      </div>

      {r.forma_pgto === 'crédito' && (
        <div className="card p-3 space-y-3">
          <div>
            <span className="rotulo">Qual cartão?</span>
            {cartoesAtivos.length === 0 ? (
              <div className="text-sm text-suave">Nenhum cartão cadastrado. <Link to="/configuracoes" className="text-primaria-sel font-semibold">Cadastrar em Configurações</Link></div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {cartoesAtivos.map((k) => (
                  <button key={k.id} type="button" onClick={() => aoMudar({ cartao_id: k.id })} aria-pressed={r.cartao_id === k.id}
                    className={`botao !min-h-12 ${r.cartao_id === k.id ? 'text-white' : 'botao-secundario'}`} style={r.cartao_id === k.id ? { background: k.cor } : undefined}>
                    <span aria-hidden>💳</span> {k.apelido} <span className="opacity-80 text-xs">•••• {k.final}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!r.id && (
            <label className="block">
              <span className="rotulo">Parcelas</span>
              <div className="flex items-center gap-3">
                <select className="campo !w-32" value={r.parcelas} onChange={(e) => aoMudar({ parcelas: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                </select>
                <span className="text-sm text-suave">{r.parcelas > 1 ? `${r.parcelas}x de ${moeda(r.valor / r.parcelas)}` : 'À vista'}</span>
              </div>
            </label>
          )}
        </div>
      )}

      {/* Quem */}
      <div>
        <span className="rotulo">Quem {r.tipo === 'despesa' ? 'gastou' : 'recebeu'}?</span>
        <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-1 px-1" role="radiogroup" aria-label="Quem">
          {usuarios.filter((u) => u.ativo).map((u) => {
            const sel = r.usuario_id === u.id
            const travado = ehJunior && u.id !== usuarioAtual.id
            return (
              <button key={u.id} type="button" role="radio" aria-checked={sel} disabled={travado} onClick={() => aoMudar({ usuario_id: u.id })}
                className={`botao flex-col gap-1 !px-3 !min-h-20 shrink-0 ${sel ? 'bg-primaria-sel text-white' : 'botao-secundario'} ${travado ? 'hidden' : ''}`}>
                <Avatar usuario={u} tamanho={34} />
                <span className="text-xs font-semibold">{u.apelido}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Anexo */}
      {r.previa && (
        <div>
          <span className="rotulo">Comprovante</span>
          <img src={r.previa} alt="Comprovante anexado" className="w-full max-h-48 object-contain rounded-xl border border-borda bg-painel" />
        </div>
      )}

      <div className="mt-auto pt-2 space-y-2 sticky bottom-0 bg-painel pb-2">
        <button type="button" className="botao botao-verde !min-h-18 text-xl w-full shadow-lg" disabled={!pronto || salvando} onClick={aoConfirmar}>
          {salvando ? 'Salvando…' : <><span aria-hidden>✅</span> {editando ? 'Salvar alterações' : 'Confirmar'}</>}
        </button>
        <button type="button" className="botao botao-fantasma w-full" onClick={aoVoltar} disabled={salvando}><span aria-hidden>←</span> Voltar</button>
      </div>

      <FolhaCategorias aberta={folhaCategorias} aoFechar={() => setFolhaCategorias(false)} categorias={categorias} grupos={grupos} tipo={r.tipo} selecionada={r.categoria_id} aoEscolher={(c) => aoMudar({ categoria_id: c.id })} />
    </div>
  )
}
