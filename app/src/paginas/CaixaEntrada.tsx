/**
 * /caixa — Caixa de entrada: gastos capturados por SMS, e-mail e fatura.
 * Cada item pergunta "R$ 87,40 · Loja — qual é a despesa?" com os chips do
 * cardápio e a sugestão marcada. Um toque lança.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ErroApi } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import type { ItemCaixaEntrada } from '../tipos'
import { moeda } from '../util/formato'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Icone } from '../componentes/Icone'
import { CartaoCaixa } from '../componentes/caixa/CartaoCaixa'
import { FolhaCardapio } from '../componentes/caixa/FolhaCardapio'
import { ImportarFatura } from '../componentes/caixa/ImportarFatura'

export default function CaixaEntrada() {
  const { usuario, usuarios, categorias, cartoes } = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const setPendentesCaixa = useSessao((e) => e.setPendentesCaixa)
  const ehDependente = usuario.perfil === 'Dependente'
  const [itens, setItens] = useState<ItemCaixaEntrada[] | null>(null)
  const [aba, setAba] = useState<'pendentes' | 'resolvidos'>('pendentes')
  const [saindo, setSaindo] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [outras, setOutras] = useState<ItemCaixaEntrada | null>(null)
  const [importar, setImportar] = useState(false)

  useEffect(() => {
    let vivo = true
    api<ItemCaixaEntrada[]>('listar_caixa_entrada').then((l) => vivo && setItens(l)).catch((e) => { if (vivo) { setItens([]); avisar(e instanceof Error ? e.message : 'Não foi possível carregar', { tipo: 'erro' }) } })
    return () => { vivo = false }
  }, [avisar])

  const pendentes = (itens ?? []).filter((i) => i.status === 'pendente').sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1))
  const resolvidos = (itens ?? []).filter((i) => i.status !== 'pendente').sort((a, b) => (a.recebido_em < b.recebido_em ? 1 : -1))

  useEffect(() => { if (itens) setPendentesCaixa(pendentes.length) }, [itens, pendentes.length, setPendentesCaixa])

  async function resolver(item: ItemCaixaEntrada, acao: 'lancar' | 'ignorar', categoriaId?: string) {
    if (ocupado) return
    setOcupado(item.id)
    const cat = categorias.find((c) => c.id === (categoriaId ?? item.sugestao_categoria))
    const marcarLocal = (status: ItemCaixaEntrada['status']) => {
      setSaindo((s) => new Set(s).add(item.id))
      setTimeout(() => {
        setItens((l) => (l ?? []).map((x) => (x.id === item.id ? { ...x, status } : x)))
        setSaindo((s) => { const n = new Set(s); n.delete(item.id); return n })
      }, 260)
    }
    try {
      const r = await api<ItemCaixaEntrada>('resolver_caixa_entrada', { id: item.id, acao_caixa: acao, categoria_id: acao === 'lancar' ? cat?.id : undefined })
      marcarLocal(r.status ?? (acao === 'lancar' ? 'lançado' : 'ignorado'))
      avisar(acao === 'lancar' ? `Lançado: ${moeda(item.valor)} em ${cat?.nome ?? 'despesa'}` : 'Item ignorado', { tipo: 'ok' })
    } catch (e) {
      if (e instanceof ErroApi && e.offline) { avisar(e.message, { tipo: 'info', duracao: 6000 }); marcarLocal(acao === 'lancar' ? 'lançado' : 'ignorado') }
      else avisar(e instanceof Error ? e.message : 'Não foi possível resolver', { tipo: 'erro' })
    } finally {
      setOcupado(null)
    }
  }

  const lista = aba === 'pendentes' ? pendentes : resolvidos

  return (
    <>
      <Cabecalho
        titulo="Caixa de entrada"
        subtitulo="Gastos capturados por SMS, e-mail e fatura. Um toque na despesa e está lançado."
        acoes={!ehDependente && <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setImportar(true)}><Icone nome="upload" /><span>Importar fatura<span className="hidden sm:inline"> do cartão</span></span></button>}
      />
      <div className="tabs" role="tablist" aria-label="Situação">
        <button type="button" role="tab" aria-selected={aba === 'pendentes'} onClick={() => setAba('pendentes')}>Pendentes{pendentes.length > 0 && <span className="num"> ({pendentes.length})</span>}</button>
        <button type="button" role="tab" aria-selected={aba === 'resolvidos'} onClick={() => setAba('resolvidos')}>Resolvidos</button>
      </div>

      {itens === null ? <Carregando texto="Buscando os gastos capturados…" /> : lista.length === 0 ? (
        aba === 'pendentes' ? (
          <Vazio icone="inbox" titulo="Tudo em dia" texto="Nenhum gasto esperando classificação. Os SMS e alertas do banco caem aqui sozinhos.">
            <Link to="/captura" className="btn btn-ghost"><Icone nome="smartphone" />Configurar a captura automática</Link>
          </Vazio>
        ) : <Vazio icone="list-checks" titulo="Nada resolvido ainda" texto="Os itens lançados ou ignorados aparecem aqui." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map((item) => (
            <CartaoCaixa
              key={item.id}
              item={item}
              categorias={categorias}
              cartoes={cartoes}
              usuarios={usuarios}
              saindo={saindo.has(item.id)}
              ocupado={ocupado === item.id}
              aoResolver={(cid) => resolver(item, 'lancar', cid)}
              aoOutras={() => setOutras(item)}
              aoIgnorar={() => resolver(item, 'ignorar')}
            />
          ))}
        </div>
      )}

      {outras && (
        <FolhaCardapio
          aberta
          aoFechar={() => setOutras(null)}
          titulo={`${moeda(outras.valor)} · ${outras.estabelecimento} — qual é a despesa?`}
          escolhida={outras.sugestao_categoria}
          aoEscolher={(c) => { const it = outras; setOutras(null); resolver(it, 'lancar', c.id) }}
        />
      )}
      {!ehDependente && (
        <ImportarFatura aberta={importar} aoFechar={() => setImportar(false)} cartoes={cartoes} usuarios={usuarios} avisar={avisar} aoConcluir={(criados) => { setItens((l) => [...criados, ...(l ?? [])]); setAba('pendentes') }} />
      )}
    </>
  )
}
