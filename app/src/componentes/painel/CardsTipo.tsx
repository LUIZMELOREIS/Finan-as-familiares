/** Os 4 cards de tipo (Receitas · Despesas fixas · Despesas variáveis · Projetos) — `.groups/.gcard` da referência. */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ResumoMes, Tipo } from '../../tipos'
import { Icone, corVar } from '../Icone'
import { brl } from './formato'

export interface CardTipo {
  tipo: Tipo
  valor: number
  meta: string
  pct: number
  direita: string
  para: string
}

/** Monta os 4 cards a partir do resumo do mês. `apenas` restringe (Dependente vê só variáveis e projetos). */
export function montarCards(tipos: Tipo[], resumo: ResumoMes | null, apenas?: Array<Tipo['id']>): CardTipo[] {
  const ordenados = [...tipos].sort((a, b) => a.ordem - b.ordem).filter((t) => !apenas || apenas.includes(t.id))
  return ordenados.map((t) => {
    const pt = resumo?.por_tipo[t.id] ?? { realizado: 0, orcado: 0 }
    if (t.id === 't_projetos') {
      const p = resumo?.projetos ?? { guardado_total: 0, percentual_medio: 0, ativos: 0 }
      return { tipo: t, valor: p.guardado_total, meta: `${p.ativos} projeto${p.ativos === 1 ? '' : 's'} ativo${p.ativos === 1 ? '' : 's'}`, pct: p.percentual_medio, direita: `${p.percentual_medio}% das metas`, para: '/projetos' }
    }
    const pct = pt.orcado > 0 ? Math.round((pt.realizado / pt.orcado) * 100) : 0
    const rotulo = t.id === 't_receitas' ? 'Previsto' : 'Orçado'
    return { tipo: t, valor: pt.realizado, meta: pt.orcado > 0 ? `${rotulo} ${brl(pt.orcado)}` : `Sem ${rotulo.toLowerCase()}`, pct: pt.orcado > 0 ? pct : 0, direita: pt.orcado > 0 ? `${pct}%` : '—', para: `/tipo/${t.id}` }
  })
}

export function CardsTipo({ cards, children }: { cards: CardTipo[]; children?: ReactNode }) {
  const n = cards.length + (children ? 1 : 0)
  return (
    <div className={`groups${n === 3 ? ' groups-3' : ''}`}>
      {children}
      {cards.map((c) => {
        const estourou = c.tipo.id !== 't_receitas' && c.tipo.id !== 't_projetos' && c.pct > 100
        return (
          <Link key={c.tipo.id} to={c.para} className="gcard" style={{ ['--c' as string]: corVar(c.tipo.cor) }} aria-label={`${c.tipo.nome}: ${brl(c.valor)}`}>
            <div className="top"><span className="ico"><Icone nome={c.tipo.icone} /></span><span className="name">{c.tipo.nome}</span></div>
            <div className="val num">{brl(c.valor)}</div>
            <div className="bar"><span className={estourou ? 'estourou' : ''} style={{ width: `${Math.min(c.pct, 100)}%` }} /></div>
            <div className="meta"><span>{c.meta}</span><span className="num">{c.direita}</span></div>
          </Link>
        )
      })}
    </div>
  )
}
