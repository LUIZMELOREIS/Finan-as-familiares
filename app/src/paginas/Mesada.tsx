/**
 * Mesada (/mesada): o Dependente vê a própria; o adulto escolhe o dependente nas abas.
 * Saldo disponível em destaque, barra do gasto sobre a mesada, guardado em projetos,
 * gastos do mês, "Lançar despesa", "Guardar em um projeto" e "Ajustar mesada".
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import { Avatar } from '../componentes/Avatar'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Icone, corVar } from '../componentes/Icone'
import { AcaoCelular, AcoesTopbar } from '../componentes/familia/AcaoCelular'
import { lerValorBr, brl, percentualMeta } from '../componentes/familia/calculos'
import { categoriaPorId, competenciaDosFiltros, useBoot, useSessao } from '../store/sessao'
import type { Lancamento, Projeto } from '../tipos'
import { dataBr, moeda, nomeCompetencia } from '../util/formato'

interface DadosMesada { mesada_mensal: number; gasto: number; saldo: number; cofrinho: number }

export default function Mesada() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const filtros = useSessao((e) => e.filtros)
  const comp = competenciaDosFiltros(filtros)
  const eu = boot.usuario
  const ehDependente = eu.perfil === 'Dependente'
  const dependentes = useMemo(() => boot.usuarios.filter((u) => u.ativo && u.perfil === 'Dependente'), [boot.usuarios])
  const [alvoId, setAlvoId] = useState(ehDependente ? eu.id : (dependentes[0]?.id ?? ''))
  const alvo = ehDependente ? eu : dependentes.find((d) => d.id === alvoId)
  const [dados, setDados] = useState<DadosMesada | null>(null)
  const [gastos, setGastos] = useState<Lancamento[]>([])
  const [guardando, setGuardando] = useState(false)
  const feAtiva = boot.config.fe_ativa !== false

  const carregar = useCallback(async () => {
    if (!alvo) return
    setDados(null)
    try {
      const [m, ls] = await Promise.all([
        api<DadosMesada>('mesada', { usuario_id: alvo.id, competencia: comp }),
        api<Lancamento[]>('listar_lancamentos', { competencia: comp, usuario_id_filtro: alvo.id }),
      ])
      setDados(m)
      setGastos(ls.filter((l) => l.tipo === 'despesa' && l.usuario_id === alvo.id && categoriaPorId(boot.categorias, l.categoria_id)?.tipo_id !== 't_projetos'))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível carregar a mesada.', { tipo: 'erro' })
      setDados({ mesada_mensal: alvo.mesada_mensal ?? 0, gasto: 0, saldo: alvo.mesada_mensal ?? 0, cofrinho: 0 })
    }
  }, [alvo, comp, avisar, boot.categorias])
  useEffect(() => { carregar() }, [carregar])

  if (!ehDependente && dependentes.length === 0) {
    return <><Cabecalho titulo="Mesada" subtitulo="Acompanhe a mesada de cada dependente." /><Vazio icone="baby" titulo="Nenhum dependente cadastrado" texto="Convide um dependente em Configurações › Membros e defina a mesada mensal."><Link to="/configuracoes/membros" className="btn btn-primary"><Icone nome="users" />Abrir Membros</Link></Vazio></>
  }
  if (!alvo) return <><Cabecalho titulo="Mesada" /><Carregando /></>

  const mesada = dados?.mesada_mensal ?? alvo.mesada_mensal ?? 0
  const gasto = dados?.gasto ?? 0
  const saldo = dados?.saldo ?? mesada - gasto
  const pct = percentualMeta({ meta_valor: mesada, valor_atual: gasto })
  const estourou = mesada > 0 && gasto > mesada

  return (
    <>
      <Cabecalho titulo={ehDependente ? 'Minha mesada' : 'Mesada'} subtitulo={ehDependente ? `${nomeCompetencia(comp)} · combinado em família` : 'Acompanhe a mesada de cada dependente.'}
        acoes={!ehDependente ? <AcoesTopbar><Link to="/configuracoes/membros" className="btn btn-ghost"><Icone nome="settings" />Ajustar mesada</Link></AcoesTopbar> : undefined} />

      {!ehDependente && dependentes.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Dependente">
          {dependentes.map((d) => <button key={d.id} role="tab" aria-selected={alvoId === d.id} onClick={() => setAlvoId(d.id)} className="flex items-center gap-2"><Avatar usuario={d} tamanho={20} />{d.apelido}</button>)}
        </div>
      )}

      {!dados ? <Carregando texto="Carregando a mesada…" /> : (
        <div className="grid gap-3.5 lg:grid-cols-2 items-start">
          <div className="flex flex-col gap-3.5">
            <section className="card" style={{ '--c': estourou ? 'var(--red)' : corVar(alvo.cor) } as CSSProperties} aria-labelledby="mes-t">
              <h3 id="mes-t">
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Avatar usuario={alvo} tamanho={32} />{alvo.apelido} · {nomeCompetencia(comp, true)}</span>
                <span className={`tag ${estourou ? 'red' : pct >= 80 ? 'warn' : 'ok'}`}>{estourou ? 'Passou da mesada' : pct >= 80 ? 'Perto do limite' : 'Dentro da mesada'}</span>
              </h3>
              <div className="big num" style={{ fontSize: 28, fontWeight: 600, color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {saldo < 0 ? '−' : ''}{brl(Math.abs(saldo), 2)} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{saldo >= 0 ? 'disponível' : 'além'} de {brl(mesada, 2)}</span>
              </div>
              <div className="bar" style={{ height: 8, margin: '10px 0 8px' }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Gasto sobre a mesada">
                <span className={estourou ? 'estourou' : ''} style={{ width: `${Math.min(100, mesada ? (gasto / mesada) * 100 : 0)}%` }} />
              </div>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: 0 }}>
                <div><dt style={{ fontSize: 11, color: 'var(--muted)' }}>Gasto no mês</dt><dd className="num" style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{moeda(gasto)}</dd></div>
                <div><dt style={{ fontSize: 11, color: 'var(--muted)' }}>Guardado em projetos</dt><dd className="num" style={{ margin: 0, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><Icone nome="piggy-bank" tamanho={15} />{moeda(dados.cofrinho)}</dd></div>
              </dl>
              {mesada === 0 && <p className="sub" style={{ margin: '10px 0 0' }}>Mesada ainda não definida{ehDependente ? '. Combine com os adultos.' : ': defina em Configurações › Membros.'}</p>}
              <div className="flex gap-2 flex-wrap" style={{ marginTop: 14 }}>
                {(ehDependente || alvo.id === eu.id) && <Link to="/lancar" className="btn btn-primary"><Icone nome="circle-plus" />Lançar despesa</Link>}
                {alvo.id === eu.id && <button className="btn btn-ghost" onClick={() => setGuardando(true)}><Icone nome="piggy-bank" />Guardar em um projeto</button>}
                {!ehDependente && alvo.id !== eu.id && <Link to="/projetos" className="btn btn-ghost"><Icone nome="target" />Ver projetos</Link>}
              </div>
            </section>
            {feAtiva && <p className="verse">“Quem é fiel no mínimo também é fiel no muito.”<b>Lucas 16.10</b></p>}
          </div>

          <section className="card" aria-labelledby="gastos-t">
            <h3 id="gastos-t"><span>Gastos do mês <span className="sub">{gastos.length} lançamento{gastos.length === 1 ? '' : 's'}</span></span><span className="sub num">{moeda(gasto)}</span></h3>
            {gastos.length === 0 ? <p className="sub" style={{ margin: 0 }}>Nenhum gasto registrado em {nomeCompetencia(comp, true)}.</p> : (
              <div className="rows">
                {gastos.slice(0, 40).map((l) => {
                  const c = categoriaPorId(boot.categorias, l.categoria_id)
                  return (
                    <div className="row" key={l.id}>
                      <span className="ico-sm" style={{ color: corVar(c?.cor) }}><Icone nome={c?.icone ?? 'receipt'} /></span>
                      <div className="t"><b>{l.descricao || l.estabelecimento || c?.nome || 'Despesa'}</b><small>{dataBr(l.data)}{c ? ` · ${c.nome}` : ''}{l.status === 'a_confirmar' ? ' · a confirmar' : ''}</small></div>
                      <span className="amt num">{moeda(l.valor)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {!ehDependente && dados && <AcaoCelular><Link to="/configuracoes/membros" className="btn btn-ghost btn-block"><Icone nome="settings" />Ajustar mesada</Link></AcaoCelular>}

      {guardando && <FolhaGuardar aoFechar={() => setGuardando(false)} aoSalvar={() => { setGuardando(false); carregar() }} saldo={saldo} />}
    </>
  )
}

/** Guardar parte da mesada em um projeto ativo → `aportar`. */
function FolhaGuardar({ aoFechar, aoSalvar, saldo }: { aoFechar: () => void; aoSalvar: () => void; saldo: number }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const ativos = useMemo(() => boot.projetos.filter((p: Projeto) => p.status === 'ativo'), [boot.projetos])
  const [projetoId, setProjetoId] = useState(ativos.find((p) => p.criado_por === boot.usuario.id)?.id ?? ativos[0]?.id ?? '')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const n = lerValorBr(valor)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!projetoId || n <= 0 || salvando) return
    setSalvando(true)
    try {
      await api('aportar', { projeto_id: projetoId, valor: n, observacao: 'Guardei da mesada' })
      avisar(`${moeda(n)} guardados no projeto.`, { tipo: 'ok' })
      aoSalvar()
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível guardar.', { tipo: 'erro' }) } finally { setSalvando(false) }
  }
  return (
    <Folha aberta aoFechar={aoFechar} titulo="Guardar em um projeto">
      <form onSubmit={enviar} noValidate>
        {ativos.length === 0 ? <p className="sub">Nenhum projeto ativo. Proponha um em <Link to="/projetos" style={{ color: 'var(--sel)' }}>Projetos</Link>.</p> : (
          <>
            <div className="field"><label htmlFor="gd-proj">Projeto</label><select id="gd-proj" value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>{ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div className="field"><label htmlFor="gd-valor">Valor (R$)</label><input id="gd-valor" className="amount num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus /></div>
            <p className="sub num" style={{ margin: '0 0 12px' }}>Saldo disponível da mesada: {moeda(saldo)}. Guardar um pouco todo mês vale mais do que muito de vez em quando.</p>
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!projetoId || n <= 0 || salvando}><Icone nome="piggy-bank" />{salvando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Folha>
  )
}
