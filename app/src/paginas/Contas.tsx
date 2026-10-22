/**
 * /contas — Contas a pagar: previsão de saídas para 30/60/90 dias (contas
 * fixas, parcelas, assinaturas e faturas), calendário do mês e a lista das
 * contas da competência escolhida nos filtros globais. Aceita ?enviar=1.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/cliente'
import { competenciaDosFiltros, useBoot, useSessao } from '../store/sessao'
import type { ContaAPagar, SaidaPrevista } from '../tipos'
import { dataBr, hojeIso, moeda, nomeCompetencia } from '../util/formato'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Icone } from '../componentes/Icone'
import { EnviarFatura } from '../componentes/lancar/EnviarFatura'
import { diasAte, estiloCor } from '../componentes/lancar/comuns'
import { Calendario, NOME_SITUACAO, TAG_SITUACAO, situacaoDe } from '../componentes/contas/Calendario'
import { DetalheConta } from '../componentes/contas/DetalheConta'

type Dias = 30 | 60 | 90
const STATUS_SAIDA: Record<SaidaPrevista['status'], string> = { lida_do_email: 'lida do e-mail', prevista: 'previsto', estimada: 'estimado', parcela: 'parcela', parcial: 'parcial' }

function TagPrazo({ data, status }: { data: string; status?: SaidaPrevista['status'] }) {
  const d = diasAte(data)
  if (d < 0) return <span className="tag red">vencida</span>
  if (d === 0) return <span className="tag warn">hoje</span>
  if (d <= 3) return <span className="tag warn">em {d} dia{d === 1 ? '' : 's'}</span>
  return <span className="tag proj">{status ? STATUS_SAIDA[status] : `em ${d} dias`}</span>
}

export default function Contas() {
  const { usuario, usuarios, categorias, contas_fixas } = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const filtros = useSessao((e) => e.filtros)
  const setContasAPagar = useSessao((e) => e.setContasAPagar)
  const atualizarContasFixas = useSessao((e) => e.atualizarContasFixas)
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const ehDependente = usuario.perfil === 'Dependente'
  const competencia = competenciaDosFiltros(filtros)

  const [dias, setDias] = useState<Dias>(30)
  const [saidas, setSaidas] = useState<SaidaPrevista[] | null>(null)
  const [contas, setContas] = useState<ContaAPagar[] | null>(null)
  const [abertas, setAbertas] = useState<ContaAPagar[]>([])
  const [dia, setDia] = useState<number | null>(null)
  const [detalhe, setDetalhe] = useState<ContaAPagar | null>(null)
  const [enviar, setEnviar] = useState(params.get('enviar') === '1')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (ehDependente) return
    let vivo = true
    api<SaidaPrevista[]>('proximas_saidas', { dias }).then((s) => vivo && setSaidas(s)).catch(() => vivo && setSaidas([]))
    return () => { vivo = false }
  }, [dias, versao, ehDependente])

  useEffect(() => {
    if (ehDependente) return
    let vivo = true
    setContas(null)
    setDia(null)
    api<ContaAPagar[]>('listar_contas_a_pagar', { competencia }).then((c) => vivo && setContas(c)).catch((e) => { if (vivo) { setContas([]); avisar(e instanceof Error ? e.message : 'Não foi possível carregar', { tipo: 'erro' }) } })
    api<ContaAPagar[]>('listar_contas_a_pagar', { status: 'aberta' }).then((c) => vivo && setAbertas(c)).catch(() => {})
    return () => { vivo = false }
  }, [competencia, versao, ehDependente, avisar])

  // Contador da barra lateral: contas abertas que vencem nos próximos 30 dias (ou já venceram).
  useEffect(() => { if (!ehDependente) setContasAPagar(abertas.filter((c) => diasAte(c.vencimento) <= 30).length) }, [abertas, ehDependente, setContasAPagar])

  const saidasPorMes = useMemo(() => {
    const grupos = new Map<string, SaidaPrevista[]>()
    for (const s of saidas ?? []) { const k = s.data.slice(0, 7); grupos.set(k, [...(grupos.get(k) ?? []), s]) }
    return [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [saidas])
  const totalSaidas = (saidas ?? []).reduce((s, x) => s + x.valor, 0)
  const contasFiltradas = (contas ?? []).filter((c) => dia === null || Number(c.vencimento.slice(8, 10)) === dia)
  const totalMes = (contas ?? []).reduce((s, c) => s + c.valor, 0)
  const abertasMes = (contas ?? []).filter((c) => c.status === 'aberta').length

  function abrirSaida(s: SaidaPrevista) {
    const conta = (contas ?? []).find((c) => c.id === s.id) ?? abertas.find((c) => c.id === s.id)
    if (conta) setDetalhe(conta)
    else if (s.rota && s.rota !== '/contas') nav(s.rota)
    else if (s.rota === '/contas') { const cf = contas_fixas.find((f) => f.nome === s.titulo); if (cf) avisar(`${cf.nome}: a fatura ainda não chegou. Envie o PDF para registrar.`, { tipo: 'info' }) }
  }

  function atualizarConta(c: ContaAPagar) {
    setContas((l) => (l ?? []).map((x) => (x.id === c.id ? c : x)))
    setAbertas((l) => l.filter((x) => x.id !== c.id || c.status === 'aberta'))
    setVersao((v) => v + 1)
  }

  function fecharEnvio() {
    setEnviar(false)
    if (params.get('enviar')) { params.delete('enviar'); setParams(params, { replace: true }) }
  }

  if (ehDependente) {
    return (
      <>
        <Cabecalho titulo="Contas a pagar" subtitulo="Contas da casa, parcelas e assinaturas." />
        <Vazio icone="lock" titulo="Área dos adultos" texto="As contas da casa ficam com os administradores e adultos da família. Você pode acompanhar a mesada e os projetos.">
          <Link to="/" className="btn btn-ghost"><Icone nome="layout-grid" />Voltar ao Painel</Link>
        </Vazio>
      </>
    )
  }

  const detalheCf = detalhe ? contas_fixas.find((f) => f.id === detalhe.conta_fixa_id) : undefined

  return (
    <>
      <Cabecalho
        titulo="Contas a pagar"
        subtitulo="Contas da casa, parcelas e assinaturas."
        acoes={<>
          <Link to="/configuracoes/contas-fixas" className="btn btn-ghost"><Icone nome="plus" />Nova conta fixa</Link>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setEnviar(true)}><Icone nome="upload" />Enviar fatura</button>
        </>}
      />

      <div className="card" style={{ marginBottom: 14 }}>
        <h3><span style={{ whiteSpace: 'nowrap' }}>Próximas saídas</span> <span className="sub" style={{ textAlign: 'right' }}>{saidas ? <><span className="num">{moeda(totalSaidas)}</span> em {dias} dias</> : ''}</span></h3>
        <div className="tabs" role="tablist" aria-label="Período">
          {([30, 60, 90] as Dias[]).map((d) => <button key={d} type="button" role="tab" aria-selected={dias === d} onClick={() => setDias(d)}>{d} dias</button>)}
        </div>
        {saidas === null ? <Carregando texto="Calculando as próximas saídas…" /> : saidas.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhuma saída prevista para os próximos {dias} dias.</p>
        ) : saidasPorMes.map(([mes, lista]) => (
          <div key={mes} className="menu-group" style={estiloCor('indigo')}>
            <h4>{nomeCompetencia(mes)} <span className="sub num" style={{ marginLeft: 'auto' }}>{moeda(lista.reduce((s, x) => s + x.valor, 0))}</span></h4>
            <div className="rows">
              {lista.map((s) => (
                <button key={s.id} type="button" className="row" onClick={() => abrirSaida(s)}>
                  <div className="ico-sm" aria-hidden="true"><Icone nome={s.icone} /></div>
                  <div className="t"><b>{s.titulo}</b><small>vence <span className="num">{dataBr(s.data).slice(0, 5)}</span> · {s.subtitulo}</small></div>
                  <TagPrazo data={s.data} status={s.status} />
                  <span className="amt num">{moeda(s.valor)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3><span style={{ whiteSpace: 'nowrap' }}>Contas do mês</span> <span className="sub" style={{ textAlign: 'right' }}>{nomeCompetencia(competencia)}{contas ? <> · {abertasMes} aberta{abertasMes === 1 ? '' : 's'} · <span className="num">{moeda(totalMes)}</span></> : ''}</span></h3>
        {contas === null ? <Carregando texto="Buscando as contas do mês…" /> : (
          <div className="entry">
            <Calendario competencia={competencia} contas={contas} diaSelecionado={dia} aoEscolherDia={setDia} />
            <div>
              {dia !== null && (
                <div className="flex items-center justify-between" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>Dia <span className="num">{dia}</span></span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDia(null)}><Icone nome="x" />Ver o mês todo</button>
                </div>
              )}
              {contasFiltradas.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>{contas.length === 0 ? 'Nenhuma conta registrada neste mês. Envie uma fatura ou cadastre uma conta fixa.' : 'Nenhuma conta neste dia.'}</p>
              ) : (
                <div className="rows">
                  {contasFiltradas.map((c) => {
                    const cf = contas_fixas.find((f) => f.id === c.conta_fixa_id)
                    const cat = categorias.find((x) => x.id === cf?.categoria_id)
                    const sit = situacaoDe(c, hojeIso())
                    return (
                      <button key={c.id} type="button" className="row" onClick={() => setDetalhe(c)}>
                        <div className="ico-sm" aria-hidden="true"><Icone nome={cat?.icone ?? 'receipt'} /></div>
                        <div className="t"><b>{cf?.nome ?? 'Conta'}</b><small>{c.status === 'paga' ? <>paga em <span className="num">{dataBr(c.pago_em)}</span>{c.pago_por ? ` por ${usuarios.find((u) => u.id === c.pago_por)?.apelido ?? ''}` : ''}</> : <>vence <span className="num">{dataBr(c.vencimento).slice(0, 5)}</span>{c.consumo ? ` · ${c.consumo}` : c.linha_digitavel || c.anexo_url ? ' · fatura lida' : ' · aguardando fatura'}</>}</small></div>
                        {sit === 'breve' ? <TagPrazo data={c.vencimento} /> : <span className={`tag ${TAG_SITUACAO[sit]}`}>{NOME_SITUACAO[sit].toLowerCase()}</span>}
                        <span className="amt num">{moeda(c.valor)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DetalheConta conta={detalhe} contaFixa={detalheCf} categoria={categorias.find((c) => c.id === detalheCf?.categoria_id)} usuarios={usuarios} aoFechar={() => setDetalhe(null)} aoAtualizar={atualizarConta} avisar={avisar} />

      <Folha aberta={enviar} aoFechar={fecharEnvio} titulo="Enviar fatura" largura={640}>
        <EnviarFatura contasFixas={contas_fixas} categorias={categorias} podeCriarContaFixa={usuario.perfil === 'Administrador'} aoCriarContaFixa={(cf) => atualizarContasFixas([...contas_fixas, cf])} competenciaPadrao={competencia} avisar={avisar} aoSalvar={() => { fecharEnvio(); setVersao((v) => v + 1) }} autoAbrir={params.get('enviar') === '1'} />
      </Folha>
    </>
  )
}
