/**
 * Folha "Importar fatura do cartão": cartão → PDF/OFX/CSV/foto → lista com as
 * compras já lançadas desmarcadas → "Trazer N para a Caixa".
 */
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { Cartao, ItemCaixaEntrada, LeituraExtraida, Usuario } from '../../tipos'
import { dataBr, moeda } from '../../util/formato'
import { Carregando } from '../Carregando'
import { Folha } from '../Folha'
import { Icone } from '../Icone'
import { arquivoParaTexto, nomeCartao } from '../lancar/comuns'

type Compra = NonNullable<LeituraExtraida['compras']>[number]

export function ImportarFatura({ aberta, aoFechar, cartoes, usuarios, avisar, aoConcluir }: {
  aberta: boolean
  aoFechar: () => void
  cartoes: Cartao[]
  usuarios: Usuario[]
  avisar: (texto: string, opcoes?: { tipo?: 'ok' | 'erro' | 'info' }) => void
  aoConcluir: (criados: ItemCaixaEntrada[]) => void
}) {
  const ativos = cartoes.filter((k) => k.ativo !== false)
  const [cartaoId, setCartaoId] = useState(ativos[0]?.id ?? '')
  const [lendo, setLendo] = useState(false)
  const [compras, setCompras] = useState<Compra[] | null>(null)
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function fechar() { setCompras(null); setMarcadas(new Set()); aoFechar() }

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
      avisar(`${criados.length} compra${criados.length === 1 ? '' : 's'} na Caixa de entrada`, { tipo: 'ok' })
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
      {!ativos.length ? (
        <div className="text-center" style={{ padding: '12px 0' }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum cartão cadastrado ainda.</p>
          <Link to="/configuracoes/cartoes" className="btn btn-primary" onClick={fechar}><Icone nome="credit-card" />Cadastrar cartão</Link>
        </div>
      ) : compras === null ? (
        <>
          <div className="field">
            <label htmlFor="imp-cartao">Cartão</label>
            <select id="imp-cartao" value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
              {ativos.map((k) => <option key={k.id} value={k.id}>{nomeCartao(k, usuarios)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Arquivo da fatura</label>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Aceitamos o PDF da fatura, uma foto ou os arquivos OFX/CSV que o banco exporta. Só trazemos o que ninguém lançou (mesmo valor e ±2 dias).</p>
            {lendo ? <Carregando texto="Lendo a fatura…" /> : (
              <button type="button" className="btn btn-primary btn-block" onClick={() => inputRef.current?.click()}><Icone nome="upload" />Escolher arquivo (PDF, OFX, CSV ou foto)</button>
            )}
            <input ref={inputRef} type="file" className="sr-only" aria-label="Arquivo da fatura" accept=".pdf,.ofx,.csv,.txt,application/pdf,image/*,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolherArquivo(f) }} />
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
            Encontramos <b style={{ color: 'var(--text)' }}>{compras.length}</b> compra{compras.length === 1 ? '' : 's'}. As já lançadas aparecem apagadas e desmarcadas.
          </p>
          <div className="rows">
            {compras.map((c, i) => {
              const marcada = marcadas.has(i)
              return (
                <button key={i} type="button" className="row" onClick={() => alternar(i)} aria-pressed={marcada} style={{ opacity: c.ja_lancada && !marcada ? 0.5 : 1 }}>
                  <span className="ico-sm" style={marcada ? { background: 'var(--indigo)', color: '#fff' } : undefined} aria-hidden="true">{marcada && <Icone nome="check" />}</span>
                  <div className="t"><b>{c.estabelecimento}</b><small>{dataBr(c.data)}{c.parcela ? ` · parcela ${c.parcela}` : ''}{c.ja_lancada ? ' · já lançada' : ''}</small></div>
                  <span className="amt num">{moeda(c.valor)}</span>
                </button>
              )
            })}
          </div>
          <div className="confirm">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompras(null)}><Icone nome="chevron-left" />Outro arquivo</button>
            <button type="button" className="btn btn-primary" disabled={!marcadas.size || enviando} onClick={confirmar}>
              <Icone nome="inbox" />{enviando ? 'Trazendo…' : `Trazer ${marcadas.size} para a Caixa · ${moeda(totalMarcado)}`}
            </button>
          </div>
        </>
      )}
    </Folha>
  )
}
