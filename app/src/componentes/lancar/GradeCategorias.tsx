import { useState } from 'react'
import type { Categoria, Grupo, TipoLancamento } from '../../tipos'
import { moeda } from '../../util/formato'
import { FolhaCategorias } from './FolhaCategorias'

/** Passo 2 da digitação: grade das categorias mais usadas + "Todas as categorias". */
export function GradeCategorias({ valor, tipo, frequentes, categorias, grupos, aoEscolher, aoVoltar }: {
  valor: number
  tipo: TipoLancamento
  frequentes: Categoria[]
  categorias: Categoria[]
  grupos: Grupo[]
  aoEscolher: (c: Categoria) => void
  aoVoltar: () => void
}) {
  const [todas, setTodas] = useState(false)
  return (
    <div className="flex flex-col gap-4 flex-1">
      <button type="button" className="card card-toque p-3 text-center" onClick={aoVoltar} aria-label={`Valor ${moeda(valor)}. Toque para corrigir`}>
        <div className="text-xs text-suave">{tipo === 'despesa' ? 'Gasto de' : 'Entrada de'}</div>
        <div className="numero-grande">{moeda(valor)}</div>
        <div className="text-xs text-primaria-sel font-semibold">toque para corrigir</div>
      </button>

      <div>
        <h2 className="titulo-secao mb-2">{tipo === 'despesa' ? 'Em que foi?' : 'De onde veio?'}</h2>
        <div className="grid grid-cols-3 gap-2" role="list">
          {frequentes.map((c) => (
            <button key={c.id} type="button" role="listitem" onClick={() => aoEscolher(c)}
              className="card card-toque flex flex-col items-center justify-center gap-1 p-2 min-h-24 text-center">
              <span className="text-3xl" aria-hidden>{c.icone}</span>
              <span className="text-sm font-medium leading-tight">{c.nome}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="botao botao-secundario !min-h-14 w-full" onClick={() => setTodas(true)}>
        <span aria-hidden>📂</span> Todas as categorias
      </button>

      <FolhaCategorias aberta={todas} aoFechar={() => setTodas(false)} categorias={categorias} grupos={grupos} tipo={tipo} aoEscolher={aoEscolher} />
    </div>
  )
}
