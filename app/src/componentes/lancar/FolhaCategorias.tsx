import { useMemo, useState } from 'react'
import { Folha } from '../Folha'
import type { Categoria, Grupo, TipoLancamento } from '../../tipos'
import { normalizar } from '../../util/formato'

/** Folha "Todas as categorias" com busca e agrupamento por grupo/subgrupo. */
export function FolhaCategorias({ aberta, aoFechar, categorias, grupos, tipo, selecionada, aoEscolher }: {
  aberta: boolean
  aoFechar: () => void
  categorias: Categoria[]
  grupos: Grupo[]
  tipo: TipoLancamento
  selecionada?: string
  aoEscolher: (c: Categoria) => void
}) {
  const [busca, setBusca] = useState('')

  const secoes = useMemo(() => {
    const b = normalizar(busca)
    const lista = categorias.filter((c) => c.tipo === tipo && c.ativa !== false && (!b || normalizar(`${c.nome} ${c.subgrupo ?? ''} ${c.palavras_chave}`).includes(b)))
    const porGrupo = new Map<string, Map<string, Categoria[]>>()
    for (const c of lista) {
      if (!porGrupo.has(c.grupo_id)) porGrupo.set(c.grupo_id, new Map())
      const sub = porGrupo.get(c.grupo_id)!
      const chave = c.subgrupo || ''
      if (!sub.has(chave)) sub.set(chave, [])
      sub.get(chave)!.push(c)
    }
    return [...grupos].sort((a, b2) => a.ordem - b2.ordem).filter((g) => porGrupo.has(g.id)).map((g) => ({ grupo: g, subgrupos: [...porGrupo.get(g.id)!.entries()] }))
  }, [categorias, grupos, tipo, busca])

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Todas as categorias">
      <input className="campo mb-3" placeholder="Buscar… (ex.: mercado, luz, escola)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar categoria" autoFocus />
      {secoes.length === 0 && <p className="text-suave text-center py-6">Nenhuma categoria com “{busca}”.</p>}
      {secoes.map(({ grupo, subgrupos }) => (
        <section key={grupo.id} className="mb-4" aria-label={grupo.nome}>
          <h3 className="font-bold flex items-center gap-2 mb-2"><span aria-hidden>{grupo.icone}</span>{grupo.nome}</h3>
          {subgrupos.map(([sub, cats]) => (
            <div key={sub} className="mb-2">
              {sub && sub !== grupo.nome && <div className="titulo-secao !text-xs mb-1">{sub}</div>}
              <div className="grid grid-cols-2 gap-2">
                {cats.map((c) => (
                  <button key={c.id} type="button" onClick={() => { aoEscolher(c); aoFechar() }}
                    className={`botao justify-start text-left !px-3 ${selecionada === c.id ? 'bg-primaria-sel text-white' : 'botao-secundario'}`} aria-pressed={selecionada === c.id}>
                    <span className="text-xl" aria-hidden>{c.icone}</span><span className="text-sm leading-tight">{c.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </Folha>
  )
}
