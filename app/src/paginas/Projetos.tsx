/**
 * Projetos da família (/projetos): grade de cards igual à referência, card
 * "Divisão da renda" (Dar → Poupar → Viver) para adultos e a folha "Propor projeto".
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Icone } from '../componentes/Icone'
import { AcaoCelular, AcoesTopbar } from '../componentes/familia/AcaoCelular'
import { CardProjeto } from '../componentes/familia/CardProjeto'
import { FormularioProjeto } from '../componentes/familia/FormularioProjeto'
import { divisaoRenda } from '../componentes/familia/calculos'
import { carregarProjetos, type ProjetoPronto } from '../componentes/familia/projetos'
import { competenciaDosFiltros, useBoot, useSessao } from '../store/sessao'
import type { ResumoMes } from '../tipos'
import { moeda, nomeCompetencia } from '../util/formato'

export default function Projetos() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [lista, setLista] = useState<ProjetoPronto[] | null>(null)
  const [novo, setNovo] = useState(false)
  const ehDependente = boot.usuario.perfil === 'Dependente'

  const carregar = useCallback(async () => {
    try { setLista(await carregarProjetos()) } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível carregar os projetos.', { tipo: 'erro' }); setLista([]) }
  }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <Cabecalho titulo="Projetos da família" subtitulo="Metas decididas em família, com o quanto guardar por mês."
        acoes={<AcoesTopbar><button className="btn btn-primary" onClick={() => setNovo(true)}><Icone nome="circle-plus" />Propor projeto</button></AcoesTopbar>} />

      {lista === null ? <Carregando texto="Carregando os projetos…" /> : lista.length === 0 ? (
        <Vazio icone="target" titulo="Nenhum projeto ainda" texto="Proponha o primeiro: uma viagem, a reserva de emergência, um estudo.">
          <button className="btn btn-primary" onClick={() => setNovo(true)}><Icone nome="circle-plus" />Propor projeto</button>
        </Vazio>
      ) : (
        <div className="projects">
          {lista.map((p) => <CardProjeto key={p.id} projeto={p} cor={p.cor} para={`/projetos/${p.id}`} />)}
        </div>
      )}

      {lista !== null && lista.length > 0 && <AcaoCelular><button className="btn btn-primary btn-block" onClick={() => setNovo(true)}><Icone nome="circle-plus" />Propor projeto</button></AcaoCelular>}

      {!ehDependente && <DivisaoRenda />}

      <FormularioProjeto aberta={novo} aoFechar={() => setNovo(false)} aoSalvar={() => { setNovo(false); carregar() }} />
    </>
  )
}

/** Dar → Poupar → Viver: planejado (Configurações) contra o realizado do mês dos filtros. */
function DivisaoRenda() {
  const boot = useBoot()
  const filtros = useSessao((e) => e.filtros)
  const comp = competenciaDosFiltros(filtros)
  const [resumo, setResumo] = useState<ResumoMes | null>(null)

  useEffect(() => {
    let vivo = true
    api<ResumoMes>('resumo_mes', { competencia: comp }).then((r) => vivo && setResumo(r)).catch(() => vivo && setResumo(null))
    return () => { vivo = false }
  }, [comp])

  const cfg = boot.config
  const catPorId = new Map(boot.categorias.map((c) => [c.id, c]))
  let dar = 0, poupar = 0
  for (const [id, v] of Object.entries(resumo?.por_categoria ?? {})) {
    const c = catPorId.get(id)
    if (!c) continue
    if (c.grupo_analise === 'Dízimo e ofertas') dar += v.realizado
    if (c.tipo_id === 't_projetos') poupar += v.realizado
  }
  const real = divisaoRenda(resumo?.entrou ?? 0, dar, poupar, resumo?.saiu ?? 0)
  const linhas = [
    { rotulo: 'Dar', plano: cfg.divisao_dar, feito: real.dar, valor: dar, cor: 'var(--green)' },
    { rotulo: 'Poupar', plano: cfg.divisao_poupar, feito: real.poupar, valor: poupar, cor: 'var(--gold)' },
    { rotulo: 'Viver', plano: cfg.divisao_viver, feito: real.viver, valor: Math.max(0, (resumo?.saiu ?? 0) - dar), cor: 'var(--indigo)' },
  ]
  const escala = Math.max(100, ...linhas.map((l) => Math.max(l.plano, l.feito)))

  return (
    <section className="card" style={{ marginTop: 14 }} aria-labelledby="divisao-t">
      <h3 id="divisao-t">
        <span>Divisão da renda <span className="sub">Dar → Poupar → Viver · {nomeCompetencia(comp)}</span></span>
        <Link to="/configuracoes" className="sub" style={{ textDecoration: 'none' }}>Ajustar</Link>
      </h3>
      {!resumo ? <p className="sub" style={{ margin: 0 }}>Sem lançamentos neste mês.</p> : (
        <>
          <div className="hbars">
            {linhas.map((l) => (
              <div className="hb" key={l.rotulo} style={{ gridTemplateColumns: '56px 1fr' }}>
                <span className="lbl">{l.rotulo}</span>
                <div className="track">
                  <div style={{ position: 'relative', flex: 1, height: 9 }}>
                    <div className="fill" style={{ width: `${Math.min(100, (l.feito / escala) * 100)}%`, background: l.cor }} />
                    <span aria-hidden="true" style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${Math.min(100, (l.plano / escala) * 100)}% - 1px)`, width: 2, background: 'var(--text)', borderRadius: 1, opacity: .8 }} />
                  </div>
                  <span className="num" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{l.feito.toLocaleString('pt-BR')}% <span style={{ color: 'var(--faint)' }}>de {l.plano}%</span></span>
                </div>
              </div>
            ))}
          </div>
          <p className="sub num" style={{ margin: '10px 0 0' }}>
            Receita do mês {moeda(resumo.entrou)} · Dízimo e ofertas {moeda(dar)} · Aportes em projetos {moeda(poupar)}. O traço marca o planejado.
          </p>
        </>
      )}
    </section>
  )
}
