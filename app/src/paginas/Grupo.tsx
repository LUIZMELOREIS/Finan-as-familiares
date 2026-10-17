/**
 * Lista de um grupo (/grupo/:id): total do mês e orçamento, seletor de mês,
 * categorias agrupadas por subgrupo; toque na categoria expande os lançamentos;
 * toque no lançamento abre a folha de detalhes (Editar / Apagar com Desfazer).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { api } from '../api/cliente'
import { useBoot } from '../store/sessao'
import type { Categoria, Lancamento } from '../tipos'
import { competenciaDe, moeda, porcentagem } from '../util/formato'
import { useResumoMes } from '../hooks/useResumoMes'
import { SeletorMes } from '../componentes/inicio/SeletorMes'
import { BarraOrcamento } from '../componentes/inicio/CardGrupo'
import { ItemLancamento } from '../componentes/inicio/ItemLancamento'
import { DetalheLancamento } from '../componentes/inicio/DetalheLancamento'

export default function Grupo() {
  const { id } = useParams()
  const boot = useBoot()
  const grupo = boot.grupos.find((g) => g.id === id)
  const [competencia, setCompetencia] = useState(competenciaDe())
  const { resumo, carregando, recarregar } = useResumoMes(competencia)
  const [aberta, setAberta] = useState<string | null>(null)
  const [lancamentos, setLancamentos] = useState<Record<string, Lancamento[] | 'carregando'>>({})
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null)

  const categorias = useMemo(() => boot.categorias.filter((c) => c.grupo_id === id && c.ativa !== false), [boot.categorias, id])

  // Agrupa por subgrupo mantendo a ordem de cadastro.
  const subgrupos = useMemo(() => {
    const mapa = new Map<string, Categoria[]>()
    for (const c of categorias) {
      const chave = c.subgrupo || grupo?.nome || 'Outros'
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave)!.push(c)
    }
    return [...mapa.entries()]
  }, [categorias, grupo])

  const carregarCategoria = useCallback(async (categoriaId: string) => {
    setLancamentos((m) => ({ ...m, [categoriaId]: 'carregando' }))
    try {
      const ls = await api<Lancamento[]>('listar_lancamentos', { competencia, categoria_id: categoriaId })
      setLancamentos((m) => ({ ...m, [categoriaId]: ls }))
    } catch {
      setLancamentos((m) => ({ ...m, [categoriaId]: [] }))
    }
  }, [competencia])

  // Ao trocar de mês, limpa o que estava expandido.
  useEffect(() => { setLancamentos({}); setAberta(null) }, [competencia])

  function alternar(categoriaId: string) {
    if (aberta === categoriaId) { setAberta(null); return }
    setAberta(categoriaId)
    if (!lancamentos[categoriaId]) carregarCategoria(categoriaId)
  }

  function aoMudar() {
    recarregar()
    if (aberta) carregarCategoria(aberta)
  }

  if (!grupo) return <Navigate to="/" replace />
  const totais = resumo?.por_grupo[grupo.id] ?? { realizado: 0, orcado: 0 }
  const ehEntrada = grupo.tipo === 'receita'

  return (
    <>
      <Cabecalho titulo={`${grupo.icone} ${grupo.nome}`} voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="card p-4 border-l-4" style={{ borderLeftColor: grupo.cor }}>
          <div className="text-xs font-semibold uppercase tracking-wide text-suave">{ehEntrada ? 'Entrou no mês' : 'Total do mês'}</div>
          <div className={`numero-grande ${carregando ? 'opacity-40' : ''} ${ehEntrada ? 'text-verde' : ''}`}>{moeda(totais.realizado)}</div>
          {!ehEntrada && totais.orcado > 0 && <BarraOrcamento realizado={totais.realizado} orcado={totais.orcado} cor={grupo.cor} />}
        </div>

        <SeletorMes competencia={competencia} aoMudar={setCompetencia} />

        {carregando && !resumo && <Carregando texto="Carregando o mês…" />}

        {subgrupos.map(([nome, cats]) => (
          <section key={nome} aria-label={nome}>
            <h2 className="titulo-secao mb-2">{nome}</h2>
            <div className="card divide-y divide-borda overflow-hidden">
              {cats.map((c) => {
                const v = resumo?.por_categoria[c.id] ?? { realizado: 0, orcado: 0 }
                const estourou = v.orcado > 0 && v.realizado > v.orcado
                const expandida = aberta === c.id
                const lista = lancamentos[c.id]
                return (
                  <div key={c.id}>
                    <button className="w-full text-left px-4 py-3 min-h-16 hover:bg-card-hover" onClick={() => alternar(c.id)} aria-expanded={expandida} aria-label={`${c.nome}: ${moeda(v.realizado)}${v.orcado ? ` de ${moeda(v.orcado)} planejados` : ''}. ${expandida ? 'Recolher' : 'Ver lançamentos'}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `color-mix(in srgb, ${c.cor} 22%, transparent)` }} aria-hidden>{c.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold leading-tight line-clamp-2">{c.nome}</div>
                          {v.orcado > 0 && <div className={`text-xs ${estourou ? 'text-vermelho font-semibold' : 'text-suave'}`}>{porcentagem(v.realizado, v.orcado)}% de {moeda(v.orcado)}</div>}
                        </div>
                        <div className={`font-bold tabular-nums shrink-0 ${ehEntrada ? 'text-verde' : ''}`}>{moeda(v.realizado)}</div>
                        <span className={`text-suave transition-transform ${expandida ? 'rotate-90' : ''}`} aria-hidden>›</span>
                      </div>
                      {v.orcado > 0 && (
                        <div className="progresso mt-2" aria-hidden>
                          <span style={{ width: `${Math.min(100, porcentagem(v.realizado, v.orcado))}%`, background: estourou ? 'var(--vermelho)' : c.cor }} />
                        </div>
                      )}
                    </button>
                    {expandida && (
                      <div className="bg-painel/60 border-t border-borda">
                        {lista === 'carregando' || !lista ? (
                          <Carregando texto="Buscando lançamentos…" />
                        ) : lista.length === 0 ? (
                          <div className="px-4 py-5 text-sm text-suave text-center">Nenhum lançamento nesta categoria no mês.</div>
                        ) : (
                          lista.map((l) => <ItemLancamento key={l.id} lancamento={l} categoria={c} usuario={boot.usuarios.find((u) => u.id === l.usuario_id)} aoTocar={setSelecionado} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {!subgrupos.length && <Vazio icone={grupo.icone} titulo="Sem categorias" texto="Este grupo ainda não tem categorias cadastradas." />}
      </div>

      <DetalheLancamento
        lancamento={selecionado}
        categoria={boot.categorias.find((c) => c.id === selecionado?.categoria_id)}
        usuarios={boot.usuarios}
        cartoes={boot.cartoes}
        aoFechar={() => setSelecionado(null)}
        aoMudar={aoMudar}
      />
    </>
  )
}
