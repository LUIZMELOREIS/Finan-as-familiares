import { useEffect, useState } from 'react'
import { Folha } from '../Folha'
import { Carregando } from '../Carregando'
import { api } from '../../api/cliente'
import type { Cartao, Categoria, Lancamento, Usuario } from '../../tipos'
import { moeda } from '../../util/formato'
import { ItemLancamento } from '../inicio/ItemLancamento'
import { DetalheLancamento } from '../inicio/DetalheLancamento'

export interface FiltroLancamentos {
  titulo: string
  competencia?: string
  categoria_id?: string
  grupo_id?: string
  usuario_id_filtro?: string
  /** Vários meses (ex.: ano inteiro): consulta cada um e junta. */
  competencias?: string[]
}

/** Folha com os lançamentos de um filtro do painel (toque em fatia, barra, categoria…). */
export function FolhaLancamentos({ filtro, aoFechar, categorias, usuarios, cartoes }: {
  filtro: FiltroLancamentos | null
  aoFechar: () => void
  categorias: Categoria[]
  usuarios: Usuario[]
  cartoes: Cartao[]
}) {
  const [lista, setLista] = useState<Lancamento[] | null>(null)
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!filtro) { setLista(null); return }
    let ativo = true
    setLista(null)
    const base = { categoria_id: filtro.categoria_id, grupo_id: filtro.grupo_id, usuario_id_filtro: filtro.usuario_id_filtro, status: 'confirmado' }
    const chamadas = filtro.competencias?.length
      ? filtro.competencias.map((c) => api<Lancamento[]>('listar_lancamentos', { ...base, competencia: c }))
      : [api<Lancamento[]>('listar_lancamentos', { ...base, competencia: filtro.competencia })]
    Promise.all(chamadas)
      .then((partes) => { if (ativo) setLista(partes.flat().filter((l) => l.tipo === 'despesa' || !!filtro.categoria_id || !!filtro.grupo_id).sort((a, b) => (a.data < b.data ? 1 : -1))) })
      .catch(() => { if (ativo) setLista([]) })
    return () => { ativo = false }
  }, [filtro, versao])

  const total = (lista ?? []).reduce((s, l) => s + (l.tipo === 'receita' ? -l.valor : l.valor), 0)

  return (
    <>
      <Folha aberta={!!filtro && !selecionado} aoFechar={aoFechar} titulo={filtro?.titulo ?? ''}>
        {lista === null ? <Carregando texto="Buscando lançamentos…" /> : lista.length === 0 ? (
          <div className="text-center text-suave py-8">Nenhum lançamento com este filtro.</div>
        ) : (
          <>
            <div className="flex justify-between text-sm text-suave mb-2 px-1"><span>{lista.length} {lista.length === 1 ? 'lançamento' : 'lançamentos'}</span><span>Total: <b className="text-texto tabular-nums">{moeda(Math.abs(total))}</b></span></div>
            <div className="card overflow-hidden">
              {lista.slice(0, 200).map((l) => (
                <ItemLancamento key={l.id} lancamento={l} categoria={categorias.find((c) => c.id === l.categoria_id)} usuario={usuarios.find((u) => u.id === l.usuario_id)} aoTocar={setSelecionado} mostrarCategoria />
              ))}
            </div>
          </>
        )}
      </Folha>
      <DetalheLancamento
        lancamento={selecionado}
        categoria={categorias.find((c) => c.id === selecionado?.categoria_id)}
        usuarios={usuarios}
        cartoes={cartoes}
        aoFechar={() => setSelecionado(null)}
        aoMudar={() => setVersao((v) => v + 1)}
      />
    </>
  )
}
