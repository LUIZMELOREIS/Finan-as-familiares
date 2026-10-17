import { useState } from 'react'
import type { Cartao, Categoria, ItemCaixaEntrada, Usuario } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'

export const ICONE_CANAL: Record<ItemCaixaEntrada['canal'], { icone: string; nome: string }> = {
  sms_ios: { icone: '📱', nome: 'SMS (iPhone)' },
  sms_android: { icone: '📱', nome: 'SMS (Android)' },
  email: { icone: '📧', nome: 'E-mail do banco' },
  fatura: { icone: '🧾', nome: 'Fatura importada' },
}

/** Cartão "Você gastou R$ X em Y — de que é isso?" com botões de categoria. */
export function CartaoCaixa({ item, categorias, cartoes, usuarios, ocupado, saindo, aoLancar, aoOutra, aoIgnorar }: {
  item: ItemCaixaEntrada
  categorias: Categoria[]
  cartoes: Cartao[]
  usuarios: Usuario[]
  ocupado: boolean
  saindo: boolean
  aoLancar: (categoria: Categoria) => void
  aoOutra: () => void
  aoIgnorar: () => void
}) {
  const [verTexto, setVerTexto] = useState(false)
  const cartao = cartoes.find((k) => k.final === item.final_cartao)
  const quem = usuarios.find((u) => u.id === item.usuario_id)
  const canal = ICONE_CANAL[item.canal] ?? { icone: '📥', nome: item.canal }
  const sugestoes = (item.sugestoes?.length ? item.sugestoes : [item.sugestao_categoria])
    .map((id) => categorias.find((c) => c.id === id))
    .filter((c): c is Categoria => !!c && c.ativa !== false)
    .slice(0, 6)

  return (
    <article
      className="card p-4 transition-all duration-300"
      style={saindo ? { opacity: 0, transform: 'translateX(40px) scale(0.96)' } : undefined}
      aria-busy={ocupado}
    >
      <p className="text-suave text-sm">Você gastou</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="numero-grande text-3xl">{moeda(item.valor)}</span>
        <span className="text-lg font-semibold">em {item.estabelecimento || 'compra sem nome'}</span>
      </div>
      <p className="font-bold text-lg mt-1">De que é isso?</p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-suave mt-2">
        <span>📅 {dataBr(item.data_compra)}</span>
        <span title={canal.nome}>{canal.icone} {canal.nome}</span>
        {item.final_cartao && (
          <span>💳 {cartao ? cartao.apelido : `cartão final ${item.final_cartao}`}</span>
        )}
        {quem && <span>{quem.avatar} {quem.apelido}</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {sugestoes.map((c) => (
          <button key={c.id} className="botao botao-secundario justify-start !py-2 !min-h-14 text-left" disabled={ocupado} onClick={() => aoLancar(c)} style={{ borderLeft: `5px solid ${c.cor}` }}>
            <span className="text-2xl" aria-hidden>{c.icone}</span>
            <span className="text-sm leading-tight">{c.nome}</span>
          </button>
        ))}
        <button className="botao botao-secundario justify-start !py-2 !min-h-14" disabled={ocupado} onClick={aoOutra}>
          <span className="text-2xl" aria-hidden>🔎</span>
          <span className="text-sm">Outra…</span>
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <button className="botao botao-fantasma flex-1 text-sm" onClick={() => setVerTexto((v) => !v)} aria-expanded={verTexto}>
          {verTexto ? '▴ Esconder texto' : '▾ Ver texto'}
        </button>
        <button className="botao botao-secundario flex-1 flex-col !gap-0 !py-1 text-sm" disabled={ocupado} onClick={aoIgnorar}>
          <span>🚫 Ignorar</span>
          <span className="text-[11px] font-normal text-suave">não é compra / já lancei</span>
        </button>
      </div>
      {verTexto && <pre className="mt-2 text-xs text-suave whitespace-pre-wrap bg-painel rounded-xl p-3 border border-borda">{item.texto_bruto}</pre>}
    </article>
  )
}
