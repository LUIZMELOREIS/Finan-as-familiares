import { useMemo, useState } from 'react'
import { Folha } from '../Folha'
import type { Categoria, Grupo } from '../../tipos'
import { normalizar } from '../../util/formato'

/** Folha com todas as categorias (agrupadas por card) e busca. */
export function FolhaCategorias({ aberta, aoFechar, categorias, grupos, aoEscolher, tipo = 'despesa', titulo = 'Escolha a categoria' }: {
  aberta: boolean
  aoFechar: () => void
  categorias: Categoria[]
  grupos: Grupo[]
  aoEscolher: (c: Categoria) => void
  tipo?: 'despesa' | 'receita' | 'todas'
  titulo?: string
}) {
  const [busca, setBusca] = useState('')
  const lista = useMemo(() => {
    const b = normalizar(busca)
    return categorias.filter((c) => c.ativa !== false && (tipo === 'todas' || c.tipo === tipo) && (!b || normalizar(`${c.nome} ${c.subgrupo ?? ''} ${c.palavras_chave}`).includes(b)))
  }, [categorias, busca, tipo])
  const gruposOrdenados = [...grupos].sort((a, b) => a.ordem - b.ordem)

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={titulo}>
      <input className="campo mb-3" placeholder="🔎 Buscar categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus aria-label="Buscar categoria" />
      {gruposOrdenados.map((g) => {
        const doGrupo = lista.filter((c) => c.grupo_id === g.id)
        if (!doGrupo.length) return null
        return (
          <div key={g.id} className="mb-4">
            <div className="titulo-secao mb-2 flex items-center gap-2"><span aria-hidden>{g.icone}</span>{g.nome}</div>
            <div className="grid grid-cols-2 gap-2">
              {doGrupo.map((c) => (
                <button key={c.id} className="botao botao-secundario justify-start !py-2 text-left" onClick={() => aoEscolher(c)} style={{ borderLeft: `5px solid ${c.cor}` }}>
                  <span className="text-2xl" aria-hidden>{c.icone}</span>
                  <span className="text-sm leading-tight">{c.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {!lista.length && <p className="text-suave text-center py-6">Nenhuma categoria com “{busca}”.</p>}
    </Folha>
  )
}
