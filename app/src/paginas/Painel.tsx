/**
 * Painel — tela inicial, igual à referência: 4 cards de tipo, KPIs com sparkline,
 * donuts por grupo de análise, análise mensal, anéis, detalhamento, receitas × despesas,
 * próximas saídas e avisos do assistente. Tudo clicável abre a lista de lançamentos.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import dadosBase from '../../../dados/grupos_categorias.json'
import type { Lancamento } from '../tipos'
import { api } from '../api/cliente'
import { useBoot, useSessao, competenciaDosFiltros } from '../store/sessao'
import { MESES } from '../util/formato'
import { Icone, corHex } from '../componentes/Icone'
import { Carregando } from '../componentes/Carregando'
import { CardsTipo, montarCards } from '../componentes/painel/CardsTipo'
import { EstilosLocais } from '../componentes/painel/EstilosLocais'
import { Spark, Donut, BarrasMensais, Aneis, Detalhamento, LinhasReceitaDespesa } from '../componentes/painel/Graficos'
import { ProximasSaidas, AvisosAssistente } from '../componentes/painel/Listas'
import { FolhaLancamentos, LinhaLancamento, FolhaLancamento, type FiltroLancamentos } from '../componentes/painel/Lancamentos'
import { brl, mesMinusculo, soma, subtituloPrevistos } from '../componentes/painel/formato'
import { usePainel } from '../hooks/usePainel'

const GRUPOS_ANALISE = (dadosBase as { grupos_analise: Array<{ nome: string; cor: string }> }).grupos_analise

function horaCurta(d: Date | null) {
  return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—'
}

export default function Painel() {
  const boot = useBoot()
  const filtros = useSessao((e) => e.filtros)
  const dados = usePainel()
  const [grupoSel, setGrupoSel] = useState('Alimentação')
  const [folha, setFolha] = useState<FiltroLancamentos | null>(null)

  const ehDependente = boot.usuario.perfil === 'Dependente'
  const competencia = competenciaDosFiltros(filtros)
  const CUR = filtros.mes - 1
  const mesNome = mesMinusculo(CUR)
  const mesAnterior = mesMinusculo(CUR - 1)
  const anoAtual = new Date().getFullYear()
  const filtroUsuario = ehDependente ? boot.usuario.id : filtros.membro || undefined

  const titulo = `Painel de ${mesNome}${filtros.ano !== anoAtual ? ` de ${filtros.ano}` : ''}`
  const pend = dados.pendentes
  const subtitulo = `Atualizado hoje, ${horaCurta(dados.atualizadoEm)} · ${pend === 0 ? 'nenhum lançamento aguardando categoria' : `${pend} lançamento${pend > 1 ? 's' : ''} aguardando categoria`}`

  // ---------- séries do ano ----------
  const meses = dados.painel?.meses ?? []
  const previsto = meses.map((m) => !!m.previsto)
  const REAL = meses.filter((m) => !m.previsto).length
  const receitas = meses.map((m) => m.receitas)
  const despesas = meses.map((m) => m.despesas)
  const saldo = meses.map((m) => m.saldo)
  const salarios = meses.map((m) => m.salarios)
  const outras = meses.map((m) => m.outras_receitas)
  const mesSel = meses[CUR]

  const resumo = dados.resumo
  const ant = dados.resumoAnterior
  const saldoDelta = resumo && ant ? resumo.sobrou - ant.sobrou : null
  const despDelta = resumo && ant && ant.saiu > 0 ? Math.round((resumo.saiu / ant.saiu - 1) * 100) : null

  const anoRec = soma(receitas.slice(0, REAL))
  const anoDesp = soma(despesas.slice(0, REAL))
  const grupoCor = (nome: string) => corHex(GRUPOS_ANALISE.find((g) => g.nome === nome)?.cor)
  const fatiasMes = GRUPOS_ANALISE.map((g) => ({ k: g.nome, c: corHex(g.cor), v: mesSel?.por_grupo_analise[g.nome] ?? 0 }))
  const fatiasAno = GRUPOS_ANALISE.map((g) => ({ k: g.nome, c: corHex(g.cor), v: soma(meses.slice(0, REAL).map((m) => m.por_grupo_analise[g.nome] ?? 0)) }))
  const aneis = fatiasAno.map((f) => ({ k: f.k, c: f.c, p: anoRec ? f.v / anoRec : 0 }))
  const pctMes = mesSel && mesSel.receitas > 0 ? `${Math.round((mesSel.despesas / mesSel.receitas) * 100)}%` : '—'
  const pctAno = anoRec > 0 ? `${Math.round((anoDesp / anoRec) * 100)}%` : '—'

  const barrasDetalhe = useMemo(() => {
    if (!mesSel) return []
    return boot.categorias
      .filter((c) => c.grupo_analise === grupoSel && (mesSel.por_categoria[c.id] ?? 0) > 0)
      .map((c) => ({ id: c.id, nome: c.nome, valor: mesSel.por_categoria[c.id] }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
  }, [boot.categorias, grupoSel, mesSel])

  const cards = montarCards(boot.tipos, resumo, ehDependente ? ['t_variaveis', 't_projetos'] : undefined)
  const compDe = (i: number) => `${filtros.ano}-${String(i + 1).padStart(2, '0')}`

  return (
    <>
      <EstilosLocais />
      <div className="topbar">
        <div><h2>{titulo}</h2><p>{subtitulo}</p></div>
        <div className="acoes">
          {!ehDependente && <Link className="btn btn-ghost" to="/contas?enviar=1"><Icone nome="upload" />Enviar fatura</Link>}
          <Link className="btn btn-primary so-desktop" to="/lancar"><Icone nome="circle-plus" />Lançar despesa</Link>
        </div>
      </div>

      {dados.erro && !resumo && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Icone nome="circle-alert" style={{ color: 'var(--red)' }} />
          <span style={{ flex: 1, fontSize: 13 }}>{dados.erro}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={dados.recarregar}><Icone nome="refresh-cw" />Tentar de novo</button>
        </div>
      )}
      {dados.carregando && !resumo && <Carregando texto="Montando o painel…" />}

      {boot.usuario.perfil === 'Administrador' && boot.usuarios.filter((u) => u.ativo).length < 2 && (
        <Link to="/convidar" className="card" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none' }}>
          <span className="ico-sm" aria-hidden="true" style={{ color: '#1f9d55' }}><Icone nome="message-circle" /></span>
          <span style={{ flex: 1, fontSize: 13 }}><b>Convide a família.</b> Um toque por pessoa: o convite vai pelo WhatsApp com o link e os 3 passos para instalar.</span>
          <span className="btn btn-primary btn-sm" style={{ background: '#1f9d55', borderColor: '#1f9d55' }}>Convidar</span>
        </Link>
      )}

      {ehDependente ? (
        <PainelDependente cards={cards} mesada={dados.mesada} competencia={competencia} mesNome={mesNome} usuarioId={boot.usuario.id} />
      ) : (
        <>
          <CardsTipo cards={cards} />

          <div className="dash">
            {/* Linha 2 — KPIs e donuts */}
            <article className="card kpi">
              <h3>Saldo do mês</h3>
              <div className="v num">{brl(resumo?.sobrou ?? 0)}</div>
              <div className="delta num">{saldoDelta === null ? ' ' : `${saldoDelta < 0 ? '-' : '+'}${brl(Math.abs(saldoDelta))} vs ${mesAnterior}`}</div>
              <Spark dados={saldo.slice(0, REAL)} cor={corHex('indigo')} />
            </article>
            <article className="card kpi">
              <h3>Despesas do mês</h3>
              <div className="v num">{brl(resumo?.saiu ?? 0)}</div>
              <div className="delta num">{despDelta === null ? ' ' : `${despDelta > 0 ? '+' : ''}${despDelta}% vs ${mesAnterior}`}</div>
              <Spark dados={despesas.slice(0, REAL)} cor={corHex('magenta')} />
            </article>
            <article className="card">
              <h3>Despesas no mês</h3>
              <Donut fatias={fatiasMes} centro={pctMes} sub="da receita do mês" aoClicar={(f) => setFolha({ titulo: `${f.k} · ${mesNome}`, competencia, grupo_analise: f.k, usuario_id_filtro: filtroUsuario })} />
            </article>
            <article className="card">
              <h3>Despesas no ano</h3>
              <Donut fatias={fatiasAno} centro={pctAno} sub="da receita do ano" aoClicar={(f) => setFolha({ titulo: `${f.k} · ${filtros.ano}`, ano: filtros.ano, grupo_analise: f.k, usuario_id_filtro: filtroUsuario })} />
            </article>

            {/* Linha 3 — análise mensal e anéis */}
            <article className="card span2">
              <h3>Análise mensal <span className="sub">{subtituloPrevistos(previsto)}</span></h3>
              <div className="legend"><span><i style={{ background: 'var(--indigo)' }} />Salários</span><span><i style={{ background: 'var(--magenta)' }} />Outras receitas</span></div>
              <BarrasMensais salarios={salarios} outras={outras} previsto={previsto} mesAtual={CUR} aoClicarMes={(i) => setFolha({ titulo: `Receitas · ${MESES[i].toLowerCase()}`, competencia: compDe(i), tipo_id: 't_receitas', usuario_id_filtro: filtroUsuario })} />
            </article>
            <article className="card span2">
              <h3>Participação na base anual <span className="sub">% da receita do ano</span></h3>
              <Aneis aneis={aneis} aoClicar={(a) => setFolha({ titulo: `${a.k} · ${filtros.ano}`, ano: filtros.ano, grupo_analise: a.k, usuario_id_filtro: filtroUsuario })} />
            </article>

            {/* Linha 4 — detalhamento e linhas */}
            <article className="card span2">
              <h3>Detalhamento de despesas</h3>
              <Detalhamento
                barras={barrasDetalhe}
                cor={grupoCor(grupoSel)}
                grupos={GRUPOS_ANALISE.map((g) => g.nome)}
                selecionado={grupoSel}
                aoSelecionar={setGrupoSel}
                aoClicarBarra={(b) => setFolha({ titulo: `${b.nome} · ${mesNome}`, competencia, categoria_id: b.id, usuario_id_filtro: filtroUsuario })}
                vazio={mesSel?.previsto ? 'Mês previsto: ainda não há lançamentos.' : `Sem lançamentos de ${grupoSel.toLowerCase()} em ${mesNome}.`}
              />
            </article>
            <article className="card span2">
              <h3>Receitas e despesas</h3>
              <div className="legend"><span><i style={{ background: 'var(--indigo)' }} />Receita</span><span><i style={{ background: 'var(--magenta)' }} />Despesa</span></div>
              <LinhasReceitaDespesa receitas={receitas} despesas={despesas} reais={REAL} mesAtual={CUR} aoClicarMes={(i) => setFolha({ titulo: `Lançamentos · ${MESES[i].toLowerCase()}`, competencia: compDe(i), usuario_id_filtro: filtroUsuario })} />
            </article>

            {/* Linha 5 — próximas saídas e avisos */}
            <ProximasSaidas saidas={dados.saidas} />
            <AvisosAssistente avisos={dados.avisos} />
          </div>
        </>
      )}

      <FolhaLancamentos filtro={folha} aoFechar={() => setFolha(null)} />
    </>
  )
}

/* ---------- visão do Dependente: variáveis próprias, projetos, mesada e seus lançamentos ---------- */
function PainelDependente({ cards, mesada, competencia, mesNome, usuarioId }: {
  cards: ReturnType<typeof montarCards>
  mesada: { mesada_mensal: number; gasto: number; saldo: number; cofrinho: number } | null
  competencia: string
  mesNome: string
  usuarioId: string
}) {
  const nav = useNavigate()
  const [itens, setItens] = useState<Lancamento[] | null>(null)
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null)
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    let vivo = true
    setItens(null)
    api<Lancamento[]>('listar_lancamentos', { competencia, usuario_id_filtro: usuarioId }).then((r) => { if (vivo) setItens(r) }).catch(() => { if (vivo) setItens([]) })
    return () => { vivo = false }
  }, [competencia, usuarioId, versao])
  const pct = mesada && mesada.mesada_mensal > 0 ? Math.round((mesada.gasto / mesada.mesada_mensal) * 100) : 0
  return (
    <>
      <CardsTipo cards={cards}>
        <Link to="/mesada" className="gcard" style={{ ['--c' as string]: 'var(--gold)' }}>
          <div className="top"><span className="ico"><Icone nome="piggy-bank" /></span><span className="name">Minha mesada</span></div>
          <div className="val num">{brl(mesada?.saldo ?? 0)}</div>
          <div className="bar"><span className={pct > 100 ? 'estourou' : ''} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          <div className="meta"><span>Mesada {brl(mesada?.mesada_mensal ?? 0)}</span><span className="num">{pct}% usado</span></div>
        </Link>
      </CardsTipo>
      <div className="dash">
        <article className="card kpi span2">
          <h3>Gastei em {mesNome}</h3>
          <div className="v num">{brl(mesada?.gasto ?? 0)}</div>
          <div className="delta">dos {brl(mesada?.mesada_mensal ?? 0)} da mesada</div>
        </article>
        <article className="card kpi span2">
          <h3>Cofrinho</h3>
          <div className="v num">{brl(mesada?.cofrinho ?? 0)}</div>
          <div className="delta">guardado nos projetos</div>
        </article>
        <article className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Meus lançamentos <span className="sub">{mesNome}</span></h3>
          {itens === null && <Carregando />}
          {itens && itens.length === 0 && <p className="sub" style={{ margin: 0 }}>Nenhum lançamento em {mesNome}. Toque em Lançar despesa para começar.</p>}
          {itens && itens.length > 0 && <div className="rows">{itens.slice(0, 12).map((l) => <LinhaLancamento key={l.id} l={l} aoClicar={setDetalhe} />)}</div>}
        </article>
      </div>
      <FolhaLancamento
        lancamento={detalhe}
        aoFechar={() => setDetalhe(null)}
        aoEditar={(l) => { setDetalhe(null); nav(`/lancar?editar=${encodeURIComponent(l.id)}`, { state: { lancamento: l } }) }}
        aoApagar={(id) => { setItens((xs) => (xs ? xs.filter((x) => x.id !== id) : xs)); setDetalhe(null) }}
        aoRestaurar={() => setVersao((v) => v + 1)}
      />
    </>
  )
}
