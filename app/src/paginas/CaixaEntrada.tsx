import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { useBoot, useSessao } from '../store/sessao'
import { api } from '../api/cliente'
import type { Categoria, ItemCaixaEntrada } from '../tipos'
import { dataBr, moeda } from '../util/formato'
import { Abas } from '../componentes/config/comuns'
import { CartaoCaixa, ICONE_CANAL } from '../componentes/caixa/CartaoCaixa'
import { FolhaCategorias } from '../componentes/caixa/FolhaCategorias'
import { ImportarFatura } from '../componentes/caixa/ImportarFatura'

const ROTULO_STATUS: Record<ItemCaixaEntrada['status'], { icone: string; nome: string; cor: string }> = {
  pendente: { icone: '⏳', nome: 'Pendente', cor: 'text-amarelo' },
  lançado: { icone: '✅', nome: 'Lançado', cor: 'text-verde' },
  duplicado: { icone: '🔁', nome: 'Duplicado', cor: 'text-suave' },
  ignorado: { icone: '🚫', nome: 'Ignorado', cor: 'text-suave' },
}

export default function CaixaEntrada() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const setPendentesCaixa = useSessao((e) => e.setPendentesCaixa)
  const [aba, setAba] = useState<'pendentes' | 'resolvidos'>('pendentes')
  const [itens, setItens] = useState<ItemCaixaEntrada[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupados, setOcupados] = useState<Set<string>>(new Set())
  const [saindo, setSaindo] = useState<Set<string>>(new Set())
  const [outraPara, setOutraPara] = useState<ItemCaixaEntrada | null>(null)
  const [importar, setImportar] = useState(false)
  const ehJunior = boot.usuario.perfil === 'Júnior'

  const carregar = useCallback(async () => {
    try {
      const lista = await api<ItemCaixaEntrada[]>('listar_caixa_entrada')
      setItens(lista)
      setPendentesCaixa(lista.filter((i) => i.status === 'pendente').length)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar')
      setItens([])
    }
  }, [setPendentesCaixa])
  useEffect(() => { carregar() }, [carregar])

  const pendentes = useMemo(() => (itens ?? []).filter((i) => i.status === 'pendente').sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1)), [itens])
  const resolvidos = useMemo(() => (itens ?? []).filter((i) => i.status !== 'pendente').sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1)), [itens])

  /** Remove o cartão com animação e atualiza o contador. */
  function retirar(item: ItemCaixaEntrada, atualizado: ItemCaixaEntrada) {
    setSaindo((s) => new Set(s).add(item.id))
    setTimeout(() => {
      setItens((lista) => {
        const nova = (lista ?? []).map((i) => (i.id === item.id ? { ...i, ...atualizado } : i))
        setPendentesCaixa(nova.filter((i) => i.status === 'pendente').length)
        return nova
      })
      setSaindo((s) => { const n = new Set(s); n.delete(item.id); return n })
    }, 320)
  }

  async function resolver(item: ItemCaixaEntrada, acao: 'lancar' | 'ignorar', categoria?: Categoria) {
    setOcupados((o) => new Set(o).add(item.id))
    try {
      const r = await api<ItemCaixaEntrada>('resolver_caixa_entrada', { id: item.id, acao_caixa: acao, categoria_id: categoria?.id })
      retirar(item, r)
      if (acao === 'lancar') avisar(`Lançado em ${categoria?.icone ?? ''} ${categoria?.nome ?? 'categoria'} ✅`, { tipo: 'ok' })
      else avisar('Ignorado. Não vai aparecer nos gastos.', { tipo: 'info' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível resolver'
      // Sem internet a ação fica na fila: tiramos o cartão da tela mesmo assim.
      if (/guardamos|fila|sem internet/i.test(msg)) { retirar(item, { ...item, status: acao === 'lancar' ? 'lançado' : 'ignorado' }); avisar(msg, { tipo: 'info' }) }
      else avisar(msg, { tipo: 'erro' })
    } finally {
      setOcupados((o) => { const n = new Set(o); n.delete(item.id); return n })
    }
  }

  return (
    <>
      <Cabecalho titulo="Caixa de Entrada" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Abas
          abas={[
            { id: 'pendentes', rotulo: 'Pendentes', icone: '⏳', badge: pendentes.length },
            { id: 'resolvidos', rotulo: 'Resolvidos', icone: '✅' },
          ]}
          ativa={aba}
          aoMudar={(id) => setAba(id as 'pendentes' | 'resolvidos')}
        />

        {itens === null ? (
          <Carregando texto="Buscando compras capturadas…" />
        ) : erro ? (
          <Vazio icone="⚠️" titulo="Não deu para carregar" texto={erro}>
            <button className="botao botao-primario" onClick={carregar}>Tentar de novo</button>
          </Vazio>
        ) : aba === 'pendentes' ? (
          pendentes.length ? (
            <>
              <p className="text-sm text-suave">Compras que chegaram por SMS, e-mail ou fatura. Toque na categoria e pronto — o gasto é lançado.</p>
              {!ehJunior && <button className="botao botao-secundario w-full" onClick={() => setImportar(true)}>🧾 Importar fatura do cartão (PDF, OFX ou CSV)</button>}
              {pendentes.map((item) => (
                <CartaoCaixa
                  key={item.id}
                  item={item}
                  categorias={boot.categorias}
                  cartoes={boot.cartoes}
                  usuarios={boot.usuarios}
                  ocupado={ocupados.has(item.id)}
                  saindo={saindo.has(item.id)}
                  aoLancar={(c) => resolver(item, 'lancar', c)}
                  aoOutra={() => setOutraPara(item)}
                  aoIgnorar={() => resolver(item, 'ignorar')}
                />
              ))}
            </>
          ) : (
            <Vazio icone="🎉" titulo="Tudo em dia!" texto="Nenhuma compra esperando. Quando o banco avisar uma compra, ela aparece aqui.">
              <div className="flex flex-col gap-2 items-center">
                <Link to="/captura" className="botao botao-primario">⚡ Configurar captura automática</Link>
                {!ehJunior && <button className="botao botao-secundario" onClick={() => setImportar(true)}>🧾 Importar fatura do cartão</button>}
              </div>
            </Vazio>
          )
        ) : resolvidos.length ? (
          <ul className="space-y-2">
            {resolvidos.map((i) => {
              const cat = boot.categorias.find((c) => c.id === i.sugestao_categoria)
              const st = ROTULO_STATUS[i.status]
              const canal = ICONE_CANAL[i.canal]
              return (
                <li key={i.id} className="card p-3 flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{i.status === 'lançado' ? (cat?.icone ?? '✅') : st.icone}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{i.estabelecimento}</div>
                    <div className="text-xs text-suave">{dataBr(i.data_compra)} · {canal?.icone} {canal?.nome}{i.final_cartao ? ` · final ${i.final_cartao}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{moeda(i.valor)}</div>
                    <div className={`text-xs font-semibold ${st.cor}`}>{st.icone} {st.nome}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <Vazio icone="🗂️" titulo="Nada resolvido ainda" texto="Aqui ficam as compras já lançadas, ignoradas ou duplicadas." />
        )}

      </div>

      <FolhaCategorias
        aberta={!!outraPara}
        aoFechar={() => setOutraPara(null)}
        categorias={boot.categorias}
        grupos={boot.grupos}
        aoEscolher={(c) => { const item = outraPara; setOutraPara(null); if (item) resolver(item, 'lancar', c) }}
        titulo={outraPara ? `${moeda(outraPara.valor)} em ${outraPara.estabelecimento} é…` : 'Escolha a categoria'}
      />
      <ImportarFatura
        aberta={importar}
        aoFechar={() => setImportar(false)}
        cartoes={boot.cartoes}
        avisar={avisar}
        aoConcluir={(criados) => { setItens((l) => [...criados, ...(l ?? [])]); setPendentesCaixa(pendentes.length + criados.length); setAba('pendentes') }}
      />
    </>
  )
}
