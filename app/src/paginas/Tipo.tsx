/**
 * Tipo — lista de um dos 4 cards (Receitas, Despesas fixas, Despesas variáveis),
 * agrupada por grupo do cardápio; cada categoria expande os lançamentos do mês.
 * `?categoria=ID` já abre a categoria. `t_projetos` redireciona para /projetos.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Categoria, Lancamento, ResumoMes } from '../tipos'
import { api } from '../api/cliente'
import { useBoot, useSessao, competenciaDosFiltros } from '../store/sessao'
import { somarMeses } from '../util/formato'
import { Cabecalho } from '../componentes/Cabecalho'
import { Icone, corVar } from '../componentes/Icone'
import { Carregando, Vazio } from '../componentes/Carregando'
import { FolhaLancamento, LinhaLancamento } from '../componentes/painel/Lancamentos'
import { EstilosLocais } from '../componentes/painel/EstilosLocais'
import { brl, mesMinusculo } from '../componentes/painel/formato'

export default function Tipo() {
  const { id } = useParams()
  if (id === 't_projetos') return <Navigate to="/projetos" replace />
  return <TelaTipo id={id ?? ''} />
}

function TelaTipo({ id }: { id: string }) {
  const boot = useBoot()
  const filtros = useSessao((e) => e.filtros)
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const tipo = boot.tipos.find((t) => t.id === id)
  const ehDependente = boot.usuario.perfil === 'Dependente'
  const filtroUsuario = ehDependente ? boot.usuario.id : filtros.membro || undefined
  const competencia = competenciaDosFiltros(filtros)
  const mesNome = mesMinusculo(filtros.mes - 1)
  const mesAnterior = mesMinusculo(filtros.mes - 2)

  const [resumo, setResumo] = useState<ResumoMes | null>(null)
  const [anterior, setAnterior] = useState<ResumoMes | null>(null)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const [expandida, setExpandida] = useState<string | null>(sp.get('categoria'))
  const [lancs, setLancs] = useState<Record<string, Lancamento[] | null>>({})
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null)
  const rolou = useRef(false)

  useEffect(() => {
    let vivo = true
    setErro('')
    Promise.all([
      api<ResumoMes>('resumo_mes', { competencia, usuario_id_filtro: filtroUsuario }),
      api<ResumoMes>('resumo_mes', { competencia: somarMeses(competencia, -1), usuario_id_filtro: filtroUsuario }).catch(() => null),
    ]).then(([r, a]) => { if (vivo) { setResumo(r); setAnterior(a) } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar') })
    return () => { vivo = false }
  }, [competencia, filtroUsuario, versao])

  const carregarLancs = useCallback((catId: string) => {
    setLancs((l) => ({ ...l, [catId]: null }))
    api<Lancamento[]>('listar_lancamentos', { competencia, categoria_id: catId, usuario_id_filtro: filtroUsuario })
      .then((r) => setLancs((l) => ({ ...l, [catId]: r })))
      .catch(() => setLancs((l) => ({ ...l, [catId]: [] })))
  }, [competencia, filtroUsuario])

  useEffect(() => { setLancs({}); if (expandida) carregarLancs(expandida) }, [competencia, filtroUsuario, versao]) // eslint-disable-line react-hooks/exhaustive-deps

  // `?categoria=` mudou com a tela já aberta (outro aviso ou link): abre a nova categoria.
  const categoriaParam = useRef(sp.get('categoria'))
  useEffect(() => {
    const alvo = sp.get('categoria')
    if (alvo === categoriaParam.current) return
    categoriaParam.current = alvo
    if (!alvo) return
    setExpandida(alvo)
    carregarLancs(alvo)
    rolou.current = false
  }, [sp, carregarLancs])

  const alternar = (catId: string) => {
    if (expandida === catId) { setExpandida(null); return }
    setExpandida(catId)
    if (!lancs[catId]) carregarLancs(catId)
  }

  // rola até a categoria pedida por ?categoria= (uma vez)
  useEffect(() => {
    const alvo = sp.get('categoria')
    if (!alvo || rolou.current || !resumo) return
    const el = document.getElementById(`cat-${alvo}`)
    if (el) { rolou.current = true; setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50) }
  }, [sp, resumo])

  if (!tipo) return <Navigate to="/" replace />

  const grupos = boot.grupos.filter((g) => g.tipo_id === tipo.id && g.ativo !== false).sort((a, b) => a.ordem - b.ordem)
  const dadosCat = (c: Categoria) => {
    const r = resumo?.por_categoria[c.id]
    return { realizado: r?.realizado ?? 0, orcado: r?.orcado || c.orcamento_mensal || 0 }
  }
  const porTipo = resumo?.por_tipo[tipo.id]
  const total = porTipo?.realizado ?? 0
  const orcado = porTipo?.orcado || boot.categorias.filter((c) => c.tipo_id === tipo.id && c.ativa).reduce((s, c) => s + (c.orcamento_mensal || 0), 0)
  const totalAnt = anterior?.por_tipo[tipo.id]?.realizado ?? 0
  const variacao = totalAnt > 0 ? Math.round((total / totalAnt - 1) * 100) : null
  const rotuloOrc = tipo.id === 't_receitas' ? 'previsto' : 'orçado'
  const subtitulo = resumo
    ? `${brl(total)} em ${mesNome} · ${rotuloOrc} ${brl(orcado)}${variacao === null ? '' : ` · ${variacao > 0 ? '+' : ''}${variacao}% vs ${mesAnterior}`}`
    : 'Carregando…'

  const aoApagar = (id: string) => {
    setLancs((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v ? v.filter((x) => x.id !== id) : v])))
    setDetalhe(null)
    setVersao((v) => v + 1)
  }

  return (
    <>
      <EstilosLocais />
      <Cabecalho titulo={tipo.nome} subtitulo={subtitulo} voltarPara="/" acoes={<Link className="btn btn-primary so-desktop" to={tipo.id === 't_receitas' ? '/lancar?tipo=t_receitas&modo=digitar' : '/lancar'}><Icone nome="circle-plus" />{tipo.id === 't_receitas' ? 'Lançar receita' : 'Lançar'}</Link>} />
      {tipo.id === 't_receitas' && <Link className="btn btn-primary btn-block so-celular" to="/lancar?tipo=t_receitas&modo=digitar" style={{ marginBottom: 14 }}><Icone nome="circle-plus" />Lançar receita (salário, renda extra…)</Link>}

      {erro && <div className="card" style={{ marginBottom: 14, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}><Icone nome="circle-alert" style={{ color: 'var(--red)' }} />{erro}<button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setVersao((v) => v + 1)}>Tentar de novo</button></div>}
      {!resumo && !erro && <Carregando />}

      {resumo && (
        <div className="card" style={{ padding: '16px 18px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="ico" style={{ ['--c' as string]: corVar(tipo.cor) }}><Icone nome={tipo.icone} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bar" style={{ ['--c' as string]: corVar(tipo.cor), height: 7 }}><span className={orcado > 0 && total > orcado && tipo.id !== 't_receitas' ? 'estourou' : ''} style={{ width: `${orcado > 0 ? Math.min(100, (total / orcado) * 100) : 0}%` }} /></div>
              <div className="sub num" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>{brl(total)} de {brl(orcado)}</span><span>{orcado > 0 ? `${Math.round((total / orcado) * 100)}%` : '—'}</span></div>
            </div>
          </div>

          {grupos.map((g) => {
            const cats = boot.categorias
              .filter((c) => c.grupo_id === g.id && c.ativa)
              .map((c) => ({ c, ...dadosCat(c) }))
              .filter((x) => x.realizado > 0 || x.orcado > 0 || expandida === x.c.id)
              .sort((a, b) => b.realizado - a.realizado)
            if (!cats.length) return null
            const totalG = cats.reduce((s, x) => s + x.realizado, 0)
            return (
              <section key={g.id} className="menu-group" style={{ ['--c' as string]: corVar(g.cor) }}>
                <h4>{g.nome}<span className="sub num" style={{ marginLeft: 'auto' }}>{brl(totalG)}</span></h4>
                <div className="rows">
                  {cats.map(({ c, realizado, orcado: orc }) => {
                    const pct = orc > 0 ? Math.round((realizado / orc) * 100) : 0
                    const aberta = expandida === c.id
                    const lista = lancs[c.id]
                    return (
                      <div key={c.id} id={`cat-${c.id}`}>
                        <button type="button" className="row" aria-expanded={aberta} onClick={() => alternar(c.id)} style={{ minHeight: 48 }}>
                          <span className="ico-sm" style={{ color: corVar(c.cor) }}><Icone nome={c.icone} tamanho={16} /></span>
                          <span className="t">
                            <b>{c.nome}</b>
                            <small className="num">{orc > 0 ? `${rotuloOrc} ${brl(orc)} · ${pct}%` : `sem ${rotuloOrc}`}</small>
                            <span className="bar" style={{ display: 'block', marginTop: 5, height: 4, maxWidth: 220, ['--c' as string]: corVar(c.cor) }}><span className={pct > 100 && tipo.id !== 't_receitas' ? 'estourou' : ''} style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                          </span>
                          <span className="amt num">{brl(realizado)}</span>
                          <Icone nome="chevron-down" style={{ color: 'var(--muted)', transition: 'transform .15s', transform: aberta ? 'rotate(180deg)' : undefined }} />
                        </button>
                        {aberta && (
                          <div style={{ paddingLeft: 42, paddingBottom: 6 }}>
                            {lista === null || lista === undefined ? <Carregando texto="Buscando lançamentos…" /> : lista.length === 0
                              ? <p className="sub" style={{ margin: '4px 0 8px' }}>Nenhum lançamento de {c.nome.toLowerCase()} em {mesNome}.</p>
                              : <div className="rows" style={{ borderTop: '1px solid var(--line)' }}>{lista.map((l) => <LinhaLancamento key={l.id} l={l} aoClicar={setDetalhe} />)}</div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
          {grupos.every((g) => !boot.categorias.some((c) => c.grupo_id === g.id && c.ativa && (dadosCat(c).realizado > 0 || dadosCat(c).orcado > 0))) && (
            <div style={{ paddingBottom: 12 }}><Vazio icone={tipo.icone} titulo={`Nada em ${tipo.nome.toLowerCase()} neste mês`} texto="Quando houver lançamentos ou orçamento, as categorias aparecem aqui." /></div>
          )}
        </div>
      )}

      <FolhaLancamento
        lancamento={detalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={(l) => { setDetalhe(null); nav(`/lancar?editar=${encodeURIComponent(l.id)}`, { state: { lancamento: l } }) }}
        aoApagar={aoApagar}
        aoRestaurar={() => setVersao((v) => v + 1)}
      />
    </>
  )
}
