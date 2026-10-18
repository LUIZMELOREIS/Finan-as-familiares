/**
 * Card de projeto igual ao `.card.proj` da referência: ícone no quadrado de 32 px
 * com a cor do projeto, nome, etiqueta de situação, "R$ 9.840 de R$ 18.000",
 * barra de 8 px, Guardar por mês / Data-alvo e o selo de votação.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icone, corVar } from '../Icone'
import { brl, etiquetaSituacao, percentualMeta, rotuloDataAlvo, rotuloVotacao, type ProjetoCalculado } from './calculos'

interface Props {
  projeto: ProjetoCalculado
  /** Cor da paleta (gold, green, indigo…). */
  cor: string
  /** Abre o detalhe ao tocar. */
  para?: string
  /** Versão ampliada da tela de detalhe: número maior e mais colunas. */
  ampliado?: boolean
  /** Itens extras do `dl` (Média dos últimos 3 meses, Falta…). */
  extras?: Array<{ rotulo: string; valor: ReactNode }>
  children?: ReactNode
}

export function CardProjeto({ projeto: p, cor, para, ampliado, extras = [], children }: Props) {
  const etiqueta = etiquetaSituacao(p)
  const pct = percentualMeta(p)
  const estilo = { '--c': corVar(cor), textDecoration: 'none', color: 'inherit', display: 'block' } as CSSProperties
  const conteudo = (
    <>
      <h3>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span className="ico" style={{ width: ampliado ? 40 : 32, height: ampliado ? 40 : 32, borderRadius: ampliado ? 10 : 8 }}><Icone nome={p.icone || 'target'} tamanho={ampliado ? 20 : 17} /></span>
          <span style={ampliado ? { fontSize: 16, whiteSpace: 'normal' } : { whiteSpace: 'normal' }}>{p.nome}</span>
        </span>
        <span className={`tag ${etiqueta.classe}`}>{etiqueta.texto}</span>
      </h3>
      <div className="big num" style={ampliado ? { fontSize: 28 } : undefined}>
        {brl(p.valor_atual)} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>de {brl(p.meta_valor)}</span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(pct)}% da meta`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <dl style={ampliado ? { gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' } : undefined}>
        <div><dt>Guardar por mês</dt><dd className="num">{brl(p.necessario_mes)}</dd></div>
        <div><dt>Data-alvo</dt><dd>{rotuloDataAlvo(p.data_alvo)}</dd></div>
        {extras.map((e) => <div key={e.rotulo}><dt>{e.rotulo}</dt><dd className="num">{e.valor}</dd></div>)}
      </dl>
      <div className="vote"><span><Icone nome="users" tamanho={13} />{rotuloVotacao(p)}</span></div>
      {children}
    </>
  )
  if (para) return <Link to={para} className="card proj" style={estilo} aria-label={`${p.nome}: ${brl(p.valor_atual)} de ${brl(p.meta_valor)}, ${etiqueta.texto}`}>{conteudo}</Link>
  return <article className="card proj" style={estilo}>{conteudo}</article>
}
