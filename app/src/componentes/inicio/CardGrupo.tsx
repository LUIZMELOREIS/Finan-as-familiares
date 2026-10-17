import { Link } from 'react-router-dom'
import type { Grupo, Projeto } from '../../tipos'
import { moeda, porcentagem } from '../../util/formato'

/** Barra de progresso do orçamento: fica vermelha ao estourar. */
export function BarraOrcamento({ realizado, orcado, cor }: { realizado: number; orcado: number; cor: string }) {
  if (!orcado) return null
  const pct = porcentagem(realizado, orcado)
  const estourou = realizado > orcado
  return (
    <div className="mt-2">
      <div className="progresso" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% do orçamento`}>
        <span style={{ width: `${Math.min(100, pct)}%`, background: estourou ? 'var(--vermelho)' : cor }} />
      </div>
      <div className={`flex justify-between text-xs mt-1 ${estourou ? 'text-vermelho font-semibold' : 'text-suave'}`}>
        <span>{estourou ? `Passou ${moeda(realizado - orcado)} do planejado` : `${pct}% do planejado`}</span>
        <span>de {moeda(orcado)}</span>
      </div>
    </div>
  )
}

/** Card grande de um grupo (Entradas, Contas da Casa, Dia a Dia, Dízimo, Sonhos). */
export function CardGrupo({ grupo, realizado, orcado, projetos, para }: { grupo: Grupo; realizado: number; orcado: number; projetos?: Projeto[]; para?: string }) {
  const ehSonhos = grupo.tipo === 'projeto'
  const ehEntrada = grupo.tipo === 'receita'
  const ativos = (projetos ?? []).filter((p) => p.status === 'ativo').sort((a, b) => a.prioridade - b.prioridade)

  return (
    <Link to={para ?? `/grupo/${grupo.id}`} className="card card-toque block p-4 border-l-4" style={{ borderLeftColor: grupo.cor }} aria-label={`${grupo.nome}: ${moeda(realizado)} no mês`}>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `color-mix(in srgb, ${grupo.cor} 22%, transparent)` }} aria-hidden>{grupo.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg leading-tight truncate">{grupo.nome}</div>
          <div className="text-xs text-suave">{ehEntrada ? 'Entrou no mês' : ehSonhos ? 'Guardado no mês' : 'Gasto no mês'}</div>
        </div>
        <div className={`numero-grande !text-xl tabular-nums ${ehEntrada ? 'text-verde' : ''}`}>{moeda(realizado)}</div>
      </div>

      {!ehEntrada && !ehSonhos && <BarraOrcamento realizado={realizado} orcado={orcado} cor={grupo.cor} />}

      {ehSonhos && (
        <div className="mt-3 space-y-2">
          {ativos.length === 0 && <div className="text-sm text-suave">Nenhum sonho ativo. Toque para criar o primeiro.</div>}
          {ativos.slice(0, 3).map((p) => {
            const pct = porcentagem(p.valor_atual ?? p.valor_inicial, p.meta_valor)
            return (
              <div key={p.id}>
                <div className="flex justify-between text-sm">
                  <span className="truncate"><span aria-hidden>{p.icone}</span> {p.nome}</span>
                  <span className="font-semibold tabular-nums" style={{ color: grupo.cor }}>{Math.min(100, Math.round(pct))}%</span>
                </div>
                <div className="progresso mt-1" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.nome}: ${pct}% da meta`}>
                  <span style={{ width: `${Math.min(100, pct)}%`, background: grupo.cor }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}
