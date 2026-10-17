/**
 * Cardápio de despesas (igual à referência): abas Despesas fixas | Despesas
 * variáveis | Receitas, grupo "Mais usados por você" (ouro) e os grupos do tipo
 * com filete na cor do grupo e chips (ícone Lucide + nome). A sugestão vem
 * marcada (`aria-pressed`); a pessoa só confirma.
 */
import { useMemo } from 'react'
import type { Categoria, Grupo, Tipo } from '../../tipos'
import { Icone } from '../Icone'
import { estiloCor } from './comuns'

export type AbaCardapio = 't_fixas' | 't_variaveis' | 't_receitas'
const ORDEM_ABAS: AbaCardapio[] = ['t_fixas', 't_variaveis', 't_receitas']

/** Aba inicial a partir da categoria sugerida (ou do `?tipo=`). */
export function abaDe(categoria: Categoria | undefined, padrao: AbaCardapio = 't_variaveis'): AbaCardapio {
  const t = categoria?.tipo_id
  return t === 't_fixas' || t === 't_variaveis' || t === 't_receitas' ? t : padrao
}

export function Chip({ categoria, escolhida, aoEscolher }: { categoria: Categoria; escolhida: boolean; aoEscolher: (c: Categoria) => void }) {
  return (
    <button type="button" className="chip" style={estiloCor(categoria.cor)} aria-pressed={escolhida} onClick={() => aoEscolher(categoria)}>
      <Icone nome={categoria.icone} tamanho={17} /><span>{categoria.nome}</span>
    </button>
  )
}

export function Cardapio({ tipos, grupos, categorias, frequentes = [], escolhida, aoEscolher, aba, aoMudarAba }: {
  tipos: Tipo[]
  grupos: Grupo[]
  categorias: Categoria[]
  frequentes?: Categoria[]
  escolhida: string
  aoEscolher: (c: Categoria) => void
  aba: AbaCardapio
  aoMudarAba: (a: AbaCardapio) => void
}) {
  const abas = useMemo(() => ORDEM_ABAS.map((id) => tipos.find((t) => t.id === id)).filter((t): t is Tipo => !!t), [tipos])
  const gruposDaAba = useMemo(
    () => grupos.filter((g) => g.tipo_id === aba && g.ativo !== false).sort((a, b) => a.ordem - b.ordem)
      .map((g) => ({ grupo: g, itens: categorias.filter((c) => c.grupo_id === g.id && c.ativa !== false && !c.oculta_cardapio) }))
      .filter((x) => x.itens.length > 0),
    [grupos, categorias, aba],
  )

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Tipo">
        {abas.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={aba === t.id} onClick={() => aoMudarAba(t.id as AbaCardapio)}>{t.nome}</button>
        ))}
      </div>
      {frequentes.length > 0 && (
        <div className="menu-group" style={estiloCor('gold')}>
          <h4>Mais usados por você</h4>
          <div className="chips">{frequentes.map((c) => <Chip key={`f_${c.id}`} categoria={c} escolhida={c.id === escolhida} aoEscolher={aoEscolher} />)}</div>
        </div>
      )}
      {gruposDaAba.map(({ grupo, itens }) => (
        <div key={grupo.id} className="menu-group" style={estiloCor(grupo.cor)}>
          <h4>{grupo.nome}</h4>
          <div className="chips">{itens.map((c) => <Chip key={c.id} categoria={c} escolhida={c.id === escolhida} aoEscolher={aoEscolher} />)}</div>
        </div>
      ))}
    </>
  )
}
