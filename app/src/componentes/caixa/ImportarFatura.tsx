import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Folha } from '../Folha'
import { Carregando } from '../Carregando'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { Cartao, ItemCaixaEntrada, LeituraExtraida } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'
import { arquivoParaTexto } from '../config/comuns'

type Compra = NonNullable<LeituraExtraida['compras']>[number]

/** Folha "Importar fatura do cartão": escolher cartão → enviar PDF/OFX/CSV → marcar compras → trazer para a Caixa. */
export function ImportarFatura({ aberta, aoFechar, cartoes, avisar, aoConcluir }: {
  aberta: boolean
  aoFechar: () => void
  cartoes: Cartao[]
  avisar: (texto: string, opcoes?: { tipo?: 'ok' | 'erro' | 'info' }) => void
  aoConcluir: (criados: ItemCaixaEntrada[]) => void
}) {
  const nav = useNavigate()
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id ?? '')
  const [lendo, setLendo] = useState(false)
  const [compras, setCompras] = useState<Compra[] | null>(null)
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function fechar() {
    setCompras(null)
    setMarcadas(new Set())
    aoFechar()
  }

  async function aoEscolherArquivo(arquivo: File) {
    if (!cartaoId) { avisar('Escolha o cartão primeiro.', { tipo: 'erro' }); return }
    setLendo(true)
    try {
      const nome = arquivo.name.toLowerCase()
      let leitura: LeituraExtraida
      if (arquivo.type.startsWith('image/') || arquivo.type === 'application/pdf' || nome.endsWith('.pdf')) {
        const blob = arquivo.type.startsWith('image/') ? await comprimirImagem(arquivo) : arquivo
        const imagem_base64 = await arquivoParaBase64(blob)
        leitura = await api<LeituraExtraida>('importar_fatura', { imagem_base64, mime: blob.type || 'application/pdf', nome_arquivo: arquivo.name, cartao_id: cartaoId })
      } else {
        const texto = await arquivoParaTexto(arquivo)
        leitura = await api<LeituraExtraida>('importar_fatura', { texto, nome_arquivo: arquivo.name, cartao_id: cartaoId })
      }
      const lista = leitura.compras ?? []
      setCompras(lista)
      setMarcadas(new Set(lista.map((c, i) => (c.ja_lancada ? -1 : i)).filter((i) => i >= 0)))
      if (!lista.length) avisar('Não encontramos compras nesse arquivo.', { tipo: 'info' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível ler a fatura', { tipo: 'erro' })
    } finally {
      setLendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function confirmar() {
    if (!compras) return
    const escolhidas = compras.filter((_, i) => marcadas.has(i)).map(({ data, estabelecimento, valor, parcela }) => ({ data, estabelecimento, valor, parcela }))
    if (!escolhidas.length) return
    setEnviando(true)
    try {
      const criados = await api<ItemCaixaEntrada[]>('confirmar_importacao', { cartao_id: cartaoId, compras: escolhidas })
      avisar(`${criados.length} compra(s) trazidas para a Caixa ✅`, { tipo: 'ok' })
      aoConcluir(criados)
      fechar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível importar', { tipo: 'erro' })
    } finally {
      setEnviando(false)
    }
  }

  const alternar = (i: number) => setMarcadas((m) => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const totalMarcado = compras ? compras.filter((_, i) => marcadas.has(i)).reduce((s, c) => s + c.valor, 0) : 0

  return (
    <Folha aberta={aberta} aoFechar={fechar} titulo="Importar fatura do cartão">
      {!cartoes.length ? (
        <div className="text-center py-4">
          <p className="text-suave mb-3">Nenhum cartão cadastrado ainda.</p>
          <button className="botao botao-primario" onClick={() => { fechar(); nav('/configuracoes/cartoes') }}>💳 Cadastrar cartão</button>
        </div>
      ) : compras === null ? (
        <div className="space-y-4">
          <div>
            <span className="rotulo">1. Qual cartão?</span>
            <div className="grid grid-cols-1 gap-2">
              {cartoes.filter((k) => k.ativo !== false).map((k) => (
                <button key={k.id} className={`botao justify-start ${cartaoId === k.id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => setCartaoId(k.id)} aria-pressed={cartaoId === k.id}>
                  <span className="w-8 h-6 rounded" style={{ background: k.cor }} aria-hidden />
                  <span className="flex-1 text-left">{k.apelido} <span className="text-sm opacity-80">· {k.banco} · final {k.final}</span></span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="rotulo">2. Envie a fatura</span>
            <p className="text-sm text-suave mb-2">Aceitamos o <strong>PDF</strong> da fatura, uma <strong>foto</strong> ou os arquivos <strong>OFX/CSV</strong> que o banco exporta.</p>
            {lendo ? (
              <Carregando texto="Lendo a fatura… isso pode levar alguns segundos" />
            ) : (
              <label className="botao botao-primario w-full !min-h-14 cursor-pointer">
                📎 Escolher arquivo (PDF, OFX, CSV ou foto)
                <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.ofx,.csv,.txt,application/pdf,image/*,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolherArquivo(f) }} />
              </label>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-suave">
            Encontramos <strong>{compras.length}</strong> compra(s). As que já estão lançadas aparecem em cinza e desmarcadas. Marque as que quer trazer para a Caixa de Entrada.
          </p>
          <ul className="space-y-2">
            {compras.map((c, i) => {
              const marcada = marcadas.has(i)
              return (
                <li key={i}>
                  <button className={`w-full card p-3 flex items-center gap-3 text-left ${c.ja_lancada && !marcada ? 'opacity-50' : ''}`} onClick={() => alternar(i)} aria-pressed={marcada}>
                    <span className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 ${marcada ? 'bg-primaria border-primaria text-white' : 'border-borda'}`} aria-hidden>{marcada ? '✓' : ''}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{c.estabelecimento}</span>
                      <span className="block text-xs text-suave">{dataBr(c.data)}{c.parcela ? ` · parcela ${c.parcela}` : ''}{c.ja_lancada ? ' · já lançada' : ''}</span>
                    </span>
                    <span className="font-bold tabular-nums">{moeda(c.valor)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2">
            <button className="botao botao-fantasma" onClick={() => setCompras(null)}>‹ Outro arquivo</button>
            <button className="botao botao-primario flex-1 !min-h-14" disabled={!marcadas.size || enviando} onClick={confirmar}>
              {enviando ? '⏳ Trazendo…' : `📥 Trazer ${marcadas.size} para a Caixa · ${moeda(totalMarcado)}`}
            </button>
          </div>
        </div>
      )}
    </Folha>
  )
}
