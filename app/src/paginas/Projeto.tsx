/**
 * Detalhe de um projeto (/projetos/:id): card ampliado, versículo, evolução (SVG de área),
 * aportes por membro com "Registrar aporte", simulador "reduzindo X por mês, a meta fecha em…"
 * e ações do administrador/criador (editar, pausar/retomar, encerrar).
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/cliente'
import { Avatar } from '../componentes/Avatar'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Icone, corHex } from '../componentes/Icone'
import { CardProjeto } from '../componentes/familia/CardProjeto'
import { FormularioProjeto } from '../componentes/familia/FormularioProjeto'
import { GraficoArea, type PontoArea } from '../componentes/familia/GraficoArea'
import { lerValorBr, acumuladoPorMes, brl, diferencaMeses, falta, fraseComparacaoAlvo, nomeMesAno, rotuloDataAlvo, simular, type ProjetoCalculado } from '../componentes/familia/calculos'
import { carregarProjetos, versiculoPorReferencia, type ProjetoPronto } from '../componentes/familia/projetos'
import { useBoot, useSessao, usuarioPorId } from '../store/sessao'
import type { Aporte, Projeto as TipoProjeto, StatusProjeto } from '../tipos'
import { competenciaDe, dataBr, moeda, somarMeses } from '../util/formato'

const MESES_MIN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Só os campos gravados do projeto (sem os calculados), para `salvar_projeto`. */
function semCalculados(p: ProjetoCalculado): TipoProjeto & { cor?: string } {
  const { id, nome, icone, foto_url, meta_valor, data_alvo, valor_inicial, prioridade, status, versiculo, criado_por, criado_em, cor } = p
  return { id, nome, icone, foto_url, meta_valor, data_alvo, valor_inicial, prioridade, status, versiculo, criado_por, criado_em, cor }
}

export default function Projeto() {
  const { id } = useParams()
  const boot = useBoot()
  const nav = useNavigate()
  const avisar = useSessao((e) => e.avisar)
  const [projeto, setProjeto] = useState<ProjetoPronto | null | undefined>(undefined)
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [aportando, setAportando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [todosAportes, setTodosAportes] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [lista, ap] = await Promise.all([carregarProjetos(), api<Aporte[]>('listar_aportes', { projeto_id: id })])
      setProjeto(lista.find((p) => p.id === id) ?? null)
      setAportes(ap)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível carregar o projeto.', { tipo: 'erro' })
      setProjeto(null)
    }
  }, [id, avisar])
  useEffect(() => { carregar() }, [carregar])

  const compAtual = competenciaDe()
  const eu = boot.usuario
  const podeGerir = !!projeto && (eu.perfil === 'Administrador' || projeto.criado_por === eu.id)

  const pontos: PontoArea[] = useMemo(() => {
    if (!projeto) return []
    const inicio = projeto.criado_em.slice(0, 7)
    const primeiroAporte = aportes.map((a) => a.data.slice(0, 7)).sort()[0]
    let de = primeiroAporte && primeiroAporte < inicio ? primeiroAporte : inicio
    if (!/^\d{4}-\d{2}$/.test(de) || diferencaMeses(de, compAtual) > 11) de = somarMeses(compAtual, -11)
    if (diferencaMeses(de, compAtual) < 0) de = compAtual
    return acumuladoPorMes(projeto.valor_inicial, aportes, de, compAtual).map((p) => {
      const [a, m] = p.competencia.split('-').map(Number)
      return { rotulo: m === 1 || p.competencia === de ? `${MESES_MIN[m - 1]}/${String(a).slice(2)}` : MESES_MIN[m - 1], valor: p.valor, destaque: p.competencia === compAtual }
    })
  }, [projeto, aportes, compAtual])

  const porMembro = useMemo(() => {
    const soma = new Map<string, number>()
    for (const a of aportes) soma.set(a.usuario_id, (soma.get(a.usuario_id) ?? 0) + a.valor)
    return [...soma.entries()].sort((a, b) => b[1] - a[1])
  }, [aportes])

  const mudarStatus = async (status: StatusProjeto) => {
    if (!projeto || ocupado) return
    if (status === 'concluído' && !window.confirm('Encerrar este projeto? Ele sai da lista de ativos e os aportes ficam registrados.')) return
    setOcupado(true)
    try {
      await api('salvar_projeto', { projeto: { ...semCalculados(projeto), status } })
      avisar(status === 'pausado' ? 'Projeto pausado.' : status === 'ativo' ? 'Projeto retomado.' : 'Projeto encerrado.', { tipo: 'ok' })
      await carregar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível alterar o projeto.', { tipo: 'erro' })
    } finally { setOcupado(false) }
  }

  if (projeto === undefined) return <><Cabecalho titulo="Projeto" voltarPara="/projetos" /><Carregando /></>
  if (projeto === null) return <><Cabecalho titulo="Projeto" voltarPara="/projetos" /><Vazio icone="target" titulo="Projeto não encontrado" texto="Ele pode ter sido removido."><Link className="btn btn-ghost" to="/projetos">Voltar aos projetos</Link></Vazio></>

  const criador = usuarioPorId(boot.usuarios, projeto.criado_por)
  const versiculo = versiculoPorReferencia(projeto.versiculo)
  const restante = falta(projeto)
  const concluido = projeto.situacao === 'concluido' || restante <= 0
  const feAtiva = boot.config.fe_ativa !== false
  const totalAportes = aportes.reduce((s, a) => s + a.valor, 0)

  return (
    <>
      <Cabecalho titulo={projeto.nome} subtitulo={`Proposto por ${criador?.apelido ?? 'alguém da família'} em ${dataBr(projeto.criado_em.slice(0, 10))}`} voltarPara="/projetos" />

      {projeto.situacao === 'votacao' && (
        <div className="card flex items-center gap-3" style={{ padding: '10px 14px', marginBottom: 14, borderLeft: '3px solid var(--sel)' }}>
          <Icone nome="vote" />
          <span style={{ fontSize: 13, flex: 1 }}>Este projeto está em votação no Conselho da família. Os aportes começam depois da aprovação.</span>
          <Link to="/conselho" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>Ver votação<Icone nome="chevron-right" /></Link>
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <CardProjeto projeto={projeto} cor={projeto.cor} ampliado extras={[
            { rotulo: 'Média dos últimos 3 meses', valor: brl(projeto.media_3m) },
            { rotulo: 'Falta', valor: brl(restante) },
          ]}>
            {feAtiva && (concluido ? (
              <p className="verse" style={{ marginTop: 14 }}>Meta alcançada. Que a família reconheça com gratidão o que recebeu.<b>“O meu Deus, segundo as suas riquezas, suprirá todas as vossas necessidades.” — Filipenses 4.19</b></p>
            ) : versiculo ? (
              <p className="verse" style={{ marginTop: 14 }}>“{versiculo.texto}”<b>{versiculo.referencia.replace(':', '.')}</b></p>
            ) : projeto.versiculo ? <p className="verse" style={{ marginTop: 14 }}><b>{projeto.versiculo}</b></p> : null)}
            {podeGerir && (
              <div className="flex gap-2 flex-wrap" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => setEditando(true)} disabled={ocupado}><Icone nome="pencil" />Editar</button>
                {projeto.status === 'ativo' && <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => mudarStatus('pausado')} disabled={ocupado}><Icone nome="clock" />Pausar</button>}
                {projeto.status === 'pausado' && <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => mudarStatus('ativo')} disabled={ocupado}><Icone nome="refresh-cw" />Retomar</button>}
                {projeto.status !== 'concluído' && <button className="btn btn-danger btn-sm" style={{ minHeight: 44 }} onClick={() => mudarStatus('concluído')} disabled={ocupado}><Icone nome="circle-check" />Encerrar</button>}
              </div>
            )}
          </CardProjeto>

          <section className="card" aria-labelledby="evolucao-t">
            <h3 id="evolucao-t"><span>Evolução <span className="sub">guardado mês a mês</span></span></h3>
            <GraficoArea pontos={pontos} cor={corHex(projeto.cor)} meta={projeto.meta_valor} rotuloMeta="Meta" nomeSerie="Guardado" titulo={`Evolução de ${projeto.nome}`} />
          </section>
        </div>

        <div className="flex flex-col gap-3.5">
          <section className="card" aria-labelledby="aportes-t">
            <h3 id="aportes-t">
              <span>Aportes <span className="sub">{aportes.length} registro{aportes.length === 1 ? '' : 's'} · {moeda(totalAportes)}</span></span>
              {projeto.status === 'ativo' && <button className="btn btn-primary btn-sm" style={{ minHeight: 44, whiteSpace: 'nowrap' }} onClick={() => setAportando(true)}><Icone nome="plus" />Registrar aporte</button>}
            </h3>
            {porMembro.length > 0 && (
              <div className="hbars" style={{ marginBottom: 12 }}>
                {porMembro.map(([uid, v]) => {
                  const u = usuarioPorId(boot.usuarios, uid)
                  return (
                    <div className="hb" key={uid} style={{ gridTemplateColumns: '28px 1fr' }}>
                      <Avatar usuario={u} tamanho={28} />
                      <div className="track">
                        <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'var(--card-2)', overflow: 'hidden' }}><div className="fill" style={{ width: `${Math.max(2, (v / Math.max(1, totalAportes)) * 100)}%`, background: corHex(u?.cor) }} /></div>
                        <span className="num" style={{ whiteSpace: 'nowrap' }}>{u?.apelido ?? '—'} · {brl(v)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {aportes.length === 0 ? <p className="sub" style={{ margin: 0 }}>Nenhum aporte ainda. O primeiro passo pode ser pequeno.</p> : (
              <div className="rows">
                {(todosAportes ? aportes : aportes.slice(0, 6)).map((a) => {
                  const u = usuarioPorId(boot.usuarios, a.usuario_id)
                  return (
                    <div className="row" key={a.id}>
                      <Avatar usuario={u} tamanho={30} />
                      <div className="t"><b>{u?.apelido ?? 'Membro'}{a.observacao ? ` · ${a.observacao}` : ''}</b><small>{dataBr(a.data)}</small></div>
                      <span className="amt num">{moeda(a.valor)}</span>
                    </div>
                  )
                })}
                {aportes.length > 6 && <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, minHeight: 44 }} onClick={() => setTodosAportes((v) => !v)} aria-expanded={todosAportes}>{todosAportes ? 'Mostrar menos' : `Mostrar todos (${aportes.length})`}<Icone nome={todosAportes ? 'chevron-down' : 'chevron-right'} /></button>}
              </div>
            )}
          </section>

          {!concluido && projeto.status !== 'votação' && <Simulador projeto={projeto} compAtual={compAtual} />}
        </div>
      </div>

      <FolhaAporte aberta={aportando} aoFechar={() => setAportando(false)} projeto={projeto} aoSalvar={async () => { setAportando(false); await carregar() }} />
      <FormularioProjeto aberta={editando} aoFechar={() => setEditando(false)} projeto={projeto} corAtual={projeto.cor} aoSalvar={() => { setEditando(false); carregar() }} />
      {projeto.status === 'concluído' && (
        <p className="sub" style={{ marginTop: 14 }}>Projeto encerrado. <button className="btn btn-ghost btn-sm" onClick={() => nav('/projetos')}>Ver todos os projetos</button></p>
      )}
    </>
  )
}

/** Slider "Reduzir R$ X/mês em <categoria>" → "a meta fecha em <mês/ano>". */
function Simulador({ projeto, compAtual }: { projeto: ProjetoPronto; compAtual: string }) {
  const boot = useBoot()
  const variaveis = boot.categorias.filter((c) => c.tipo_id === 't_variaveis' && c.ativa && !c.oculta_cardapio)
  const [categoria, setCategoria] = useState(variaveis.some((c) => c.id === 'c_delivery') ? 'c_delivery' : (variaveis[0]?.id ?? ''))
  const [corte, setCorte] = useState(130)
  const nomeCat = variaveis.find((c) => c.id === categoria)?.nome ?? 'uma categoria'
  const atual = simular(projeto, 0, compAtual)
  const com = simular(projeto, corte, compAtual)
  return (
    <section className="card" aria-labelledby="sim-t">
      <h3 id="sim-t"><span>Simulador <span className="sub">e se a família apertasse um pouco?</span></span></h3>
      <div className="field">
        <label htmlFor="sim-corte">Reduzir <b className="num" style={{ color: 'var(--text)' }}>{brl(corte)}/mês</b> em</label>
        <select id="sim-cat" aria-label="Categoria a reduzir" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {variaveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input id="sim-corte" type="range" min={0} max={1000} step={10} value={corte} onChange={(e) => setCorte(Number(e.target.value))} style={{ width: '100%', accentColor: corHex(projeto.cor), minHeight: 44 }} aria-valuetext={`${brl(corte)} por mês`} />
      </div>
      <p className="num" style={{ margin: 0, fontSize: 14 }}>
        {com.competencia ? <>Reduzindo {nomeCat.toLowerCase()} em {brl(corte)}/mês, a meta fecha em <b style={{ fontWeight: 600 }}>{nomeMesAno(com.competencia)}</b>. <span style={{ color: 'var(--muted)' }}>{fraseComparacaoAlvo(com.diferencaAlvo)}</span></>
          : <span style={{ color: 'var(--muted)' }}>{fraseComparacaoAlvo(null)}</span>}
      </p>
      <p className="sub num" style={{ margin: '8px 0 0' }}>
        Hoje, com a média de {brl(projeto.media_3m)}/mês, {atual.competencia ? <>a meta fecha em {nomeMesAno(atual.competencia)}</> : 'a meta não tem previsão'}. Data-alvo: {rotuloDataAlvo(projeto.data_alvo)}.
      </p>
    </section>
  )
}

/** Folha "Registrar aporte": valor grande e observação → `aportar`. */
function FolhaAporte({ aberta, aoFechar, projeto, aoSalvar }: { aberta: boolean; aoFechar: () => void; projeto: ProjetoPronto; aoSalvar: () => Promise<void> }) {
  const avisar = useSessao((e) => e.avisar)
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const n = lerValorBr(valor)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (n <= 0 || salvando) return
    setSalvando(true)
    try {
      await api('aportar', { projeto_id: projeto.id, valor: n, observacao: obs.trim() })
      const atinge = (projeto.valor_atual ?? 0) + n >= projeto.meta_valor
      avisar(atinge ? 'Aporte registrado. A meta foi alcançada.' : `Aporte de ${moeda(n)} registrado.`, { tipo: 'ok' })
      setValor(''); setObs('')
      await aoSalvar()
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível registrar o aporte.', { tipo: 'erro' })
    } finally { setSalvando(false) }
  }
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={`Registrar aporte · ${projeto.nome}`}>
      <form onSubmit={enviar} noValidate>
        <div className="field">
          <label htmlFor="ap-valor">Valor (R$)</label>
          <input id="ap-valor" className="amount num" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="ap-obs">Observação (opcional)</label>
          <input id="ap-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: parte do 13º" maxLength={80} />
        </div>
        <p className="sub num" style={{ margin: '0 0 12px' }}>Falta {brl(falta(projeto))} para a meta. Guardar por mês: {brl(projeto.necessario_mes)}.</p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={n <= 0 || salvando}><Icone nome="check" />{salvando ? 'Registrando…' : 'Registrar aporte'}</button>
        </div>
      </form>
    </Folha>
  )
}
