/**
 * Patrimônio (/patrimonio): saldos informados pela família. Total do mês em destaque,
 * evolução (SVG de área da soma dos saldos), lista por item com variação e
 * folhas "Atualizar saldo" e "Novo item" (Administrador).
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../api/cliente'
import { Avatar } from '../componentes/Avatar'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Icone, HEX } from '../componentes/Icone'
import { AcaoCelular, AcoesTopbar } from '../componentes/familia/AcaoCelular'
import { GraficoArea } from '../componentes/familia/GraficoArea'
import { lerValorBr, brl, patrimonioPorMes, saldoEm } from '../componentes/familia/calculos'
import { competenciaDosFiltros, useBoot, useSessao, usuarioPorId } from '../store/sessao'
import type { Patrimonio as ItemPatrimonio } from '../tipos'
import { moeda, nomeCompetencia, somarMeses } from '../util/formato'

type TipoItem = ItemPatrimonio['tipo']
const ICONE_TIPO: Record<TipoItem, string> = { conta: 'wallet', poupanca: 'piggy-bank', investimento: 'trending-up', imovel: 'house', veiculo: 'car', outro: 'coins' }
const NOME_TIPO: Record<TipoItem, string> = { conta: 'Conta', poupanca: 'Poupança', investimento: 'Investimento', imovel: 'Imóvel', veiculo: 'Veículo', outro: 'Outro' }
const MESES_MIN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function Patrimonio() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const filtros = useSessao((e) => e.filtros)
  const comp = competenciaDosFiltros(filtros)
  const [itens, setItens] = useState<ItemPatrimonio[] | null>(null)
  const [editando, setEditando] = useState<ItemPatrimonio | null>(null)
  const [novo, setNovo] = useState(false)
  const ehAdmin = boot.usuario.perfil === 'Administrador'

  const carregar = useCallback(async () => {
    try { setItens(await api<ItemPatrimonio[]>('listar_patrimonio')) } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível carregar o patrimônio.', { tipo: 'erro' }); setItens([]) }
  }, [avisar])
  useEffect(() => { if (boot.usuario.perfil !== 'Dependente') carregar() }, [carregar, boot.usuario.perfil])

  const ativos = useMemo(() => (itens ?? []).filter((i) => i.ativo !== false), [itens])
  const total = ativos.reduce((s, i) => s + (saldoEm(i.saldos, comp) ?? 0), 0)
  const totalAnterior = ativos.reduce((s, i) => s + (saldoEm(i.saldos, somarMeses(comp, -1)) ?? 0), 0)
  const serie = useMemo(() => patrimonioPorMes(ativos, comp, 12).map((p) => {
    const [a, m] = p.competencia.split('-').map(Number)
    return { rotulo: m === 1 ? `${MESES_MIN[m - 1]}/${String(a).slice(2)}` : MESES_MIN[m - 1], valor: p.valor, destaque: p.competencia === comp }
  }), [ativos, comp])

  if (boot.usuario.perfil === 'Dependente') {
    return <><Cabecalho titulo="Patrimônio" subtitulo="Saldos informados pela família." /><Vazio icone="lock" titulo="Área dos adultos" texto="Os saldos da família são vistos pelos adultos. Os seus projetos e a sua mesada continuam disponíveis." /></>
  }

  const variacao = total - totalAnterior
  const substituir = (it: ItemPatrimonio) => setItens((ls) => { const sem = (ls ?? []).filter((x) => x.id !== it.id); return [...sem, it].sort((a, b) => a.nome.localeCompare(b.nome)) })

  return (
    <>
      <Cabecalho titulo="Patrimônio" subtitulo="Saldos informados pela família."
        acoes={ehAdmin ? <AcoesTopbar><button className="btn btn-primary" onClick={() => setNovo(true)}><Icone nome="circle-plus" />Novo item</button></AcoesTopbar> : undefined} />

      {itens === null ? <Carregando texto="Somando os saldos…" /> : (
        <div className="grid gap-3.5 lg:grid-cols-2 items-start">
          <div className="flex flex-col gap-3.5">
            <section className="card" aria-labelledby="pat-total">
              <h3 id="pat-total"><span>Total em {nomeCompetencia(comp)}</span><span className="sub">{ativos.length} ite{ativos.length === 1 ? 'm' : 'ns'}</span></h3>
              <div className="big num" style={{ fontSize: 28, fontWeight: 600 }}>{brl(total)}</div>
              <p className="sub num" style={{ margin: '4px 0 0' }}>
                {totalAnterior ? <><span style={{ color: variacao >= 0 ? 'var(--green)' : 'var(--red)' }}>{variacao >= 0 ? '+' : '−'}{brl(Math.abs(variacao))}</span> em relação a {nomeCompetencia(somarMeses(comp, -1), true)}</> : 'Sem saldo do mês anterior para comparar'}
              </p>
            </section>
            <section className="card" aria-labelledby="pat-evo">
              <h3 id="pat-evo"><span>Evolução <span className="sub">soma dos saldos nos últimos 12 meses</span></span></h3>
              <GraficoArea pontos={serie} cor={HEX.green} nomeSerie="Patrimônio" titulo="Evolução do patrimônio" />
            </section>
          </div>

          <section className="card" aria-labelledby="pat-itens">
            <h3 id="pat-itens"><span>Itens <span className="sub">toque para atualizar o saldo</span></span></h3>
            {ativos.length === 0 ? <p className="sub" style={{ margin: 0 }}>Nenhum item ainda.{ehAdmin ? ' Comece pela conta corrente e pela reserva.' : ''}</p> : (
              <div className="rows">
                {ativos.map((it) => {
                  const saldo = saldoEm(it.saldos, comp)
                  const ant = saldoEm(it.saldos, somarMeses(comp, -1))
                  const dif = saldo !== undefined && ant !== undefined ? saldo - ant : undefined
                  const titular = usuarioPorId(boot.usuarios, it.titular_id)
                  const informadoNoMes = it.saldos.some((s) => s.competencia === comp)
                  return (
                    <button className="row" key={it.id} onClick={() => setEditando(it)} style={{ minHeight: 52 }} aria-label={`${it.nome}: ${moeda(saldo)}. Atualizar saldo`}>
                      <span className="ico-sm"><Icone nome={ICONE_TIPO[it.tipo] ?? 'coins'} /></span>
                      <div className="t">
                        <b>{it.nome}</b>
                        <small className="flex items-center gap-1.5">{NOME_TIPO[it.tipo]}{it.instituicao ? ` · ${it.instituicao}` : ''} · <Avatar usuario={titular} tamanho={16} /> {titular?.apelido ?? '—'}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="amt num" style={{ display: 'block' }}>{saldo === undefined ? '—' : moeda(saldo)}</span>
                        {dif !== undefined ? <span className={`tag num ${dif > 0 ? 'ok' : dif < 0 ? 'red' : 'proj'}`}>{dif > 0 ? '+' : dif < 0 ? '−' : ''}{brl(Math.abs(dif))}</span>
                          : !informadoNoMes ? <span className="tag warn">sem saldo no mês</span> : null}
                      </div>
                      <Icone nome="chevron-right" />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {ehAdmin && itens !== null && <AcaoCelular><button className="btn btn-primary btn-block" onClick={() => setNovo(true)}><Icone nome="circle-plus" />Novo item</button></AcaoCelular>}

      {editando && <FolhaSaldo item={editando} comp={comp} ehAdmin={ehAdmin} aoFechar={() => setEditando(null)} aoSalvar={(it) => { substituir(it); setEditando(null) }} />}
      {novo && <FolhaItem comp={comp} aoFechar={() => setNovo(false)} aoSalvar={(it) => { substituir(it); setNovo(false) }} />}
    </>
  )
}

/** Atualizar saldo: competência + valor → `registrar_saldo_patrimonio`. Administrador também edita o item. */
function FolhaSaldo({ item, comp, ehAdmin, aoFechar, aoSalvar }: { item: ItemPatrimonio; comp: string; ehAdmin: boolean; aoFechar: () => void; aoSalvar: (it: ItemPatrimonio) => void }) {
  const avisar = useSessao((e) => e.avisar)
  const [competencia, setCompetencia] = useState(comp)
  const atual = saldoEm(item.saldos, competencia)
  const [valor, setValor] = useState(atual !== undefined ? String(atual).replace('.', ',') : '')
  const [salvando, setSalvando] = useState(false)
  const [editarItem, setEditarItem] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (salvando || !/^\d{4}-\d{2}$/.test(competencia)) return
    setSalvando(true)
    try {
      const it = await api<ItemPatrimonio>('registrar_saldo_patrimonio', { id: item.id, competencia, valor: lerValorBr(valor) })
      avisar(`Saldo de ${item.nome} em ${nomeCompetencia(competencia, true)} atualizado.`, { tipo: 'ok' })
      aoSalvar(it)
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível salvar o saldo.', { tipo: 'erro' }) } finally { setSalvando(false) }
  }
  if (editarItem) return <FolhaItem comp={comp} item={item} aoFechar={aoFechar} aoSalvar={aoSalvar} />
  const ultimos = [...item.saldos].sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, 6)
  return (
    <Folha aberta aoFechar={aoFechar} titulo={`Atualizar saldo · ${item.nome}`}>
      <form onSubmit={enviar} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><label htmlFor="sd-comp">Mês</label><input id="sd-comp" type="month" value={competencia} onChange={(e) => { setCompetencia(e.target.value); const v = saldoEm(item.saldos, e.target.value); setValor(v !== undefined ? String(v).replace('.', ',') : '') }} /></div>
          <div className="field"><label htmlFor="sd-valor">Saldo (R$)</label><input id="sd-valor" className="num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus /></div>
        </div>
        {ultimos.length > 0 && (
          <div className="rows" style={{ marginBottom: 12 }}>
            {ultimos.map((s) => <div className="row" key={s.competencia} style={{ padding: '6px 0' }}><div className="t"><small>{nomeCompetencia(s.competencia)}</small></div><span className="amt num" style={{ fontWeight: 500 }}>{moeda(s.valor)}</span></div>)}
          </div>
        )}
        <div className="flex gap-2 justify-between flex-wrap">
          {ehAdmin ? <button type="button" className="btn btn-ghost" onClick={() => setEditarItem(true)}><Icone nome="pencil" />Editar item</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvando}><Icone nome="check" />{salvando ? 'Salvando…' : 'Salvar saldo'}</button>
          </div>
        </div>
      </form>
    </Folha>
  )
}

/** Novo item / editar item → `salvar_patrimonio`. */
function FolhaItem({ comp, item, aoFechar, aoSalvar }: { comp: string; item?: ItemPatrimonio; aoFechar: () => void; aoSalvar: (it: ItemPatrimonio) => void }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const adultos = boot.usuarios.filter((u) => u.ativo && u.perfil !== 'Dependente')
  const [nome, setNome] = useState(item?.nome ?? '')
  const [tipo, setTipo] = useState<TipoItem>(item?.tipo ?? 'conta')
  const [instituicao, setInstituicao] = useState(item?.instituicao ?? '')
  const [titular, setTitular] = useState(item?.titular_id ?? boot.usuario.id)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [ativo, setAtivo] = useState(item?.ativo ?? true)
  const [salvando, setSalvando] = useState(false)
  const valido = nome.trim().length >= 2
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!valido || salvando) return
    setSalvando(true)
    try {
      const saldos = item ? item.saldos : saldoInicial ? [{ competencia: comp, valor: lerValorBr(saldoInicial) }] : []
      const salvo = await api<ItemPatrimonio>('salvar_patrimonio', { patrimonio: { id: item?.id ?? '', nome: nome.trim(), tipo, instituicao: instituicao.trim(), titular_id: titular, saldos, ativo } })
      avisar(item ? 'Item atualizado.' : 'Item adicionado ao patrimônio.', { tipo: 'ok' })
      aoSalvar(salvo)
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível salvar o item.', { tipo: 'erro' }) } finally { setSalvando(false) }
  }
  return (
    <Folha aberta aoFechar={aoFechar} titulo={item ? 'Editar item' : 'Novo item do patrimônio'}>
      <form onSubmit={enviar} noValidate>
        <div className="field"><label htmlFor="it-nome">Nome</label><input id="it-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Conta corrente" autoFocus maxLength={60} /></div>
        <div className="field">
          <span className="rotulo">Tipo</span>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} role="radiogroup" aria-label="Tipo do item">
            {(Object.keys(NOME_TIPO) as TipoItem[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tipo === t} aria-pressed={tipo === t} onClick={() => setTipo(t)} className="flex items-center justify-center gap-1.5"><Icone nome={ICONE_TIPO[t]} tamanho={16} />{NOME_TIPO[t]}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><label htmlFor="it-inst">Instituição</label><input id="it-inst" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Ex.: Itaú" maxLength={40} /></div>
          <div className="field"><label htmlFor="it-tit">Titular</label><select id="it-tit" value={titular} onChange={(e) => setTitular(e.target.value)}>{adultos.map((u) => <option key={u.id} value={u.id}>{u.apelido}</option>)}</select></div>
        </div>
        {!item && <div className="field"><label htmlFor="it-saldo">Saldo em {nomeCompetencia(comp, true)} (R$)</label><input id="it-saldo" className="num" inputMode="decimal" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0,00" /></div>}
        {item && (
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14, minHeight: 44 }}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>Item ativo</div><div className="sub">Itens inativos saem do total e do gráfico, mas o histórico fica.</div></div>
            <button type="button" role="switch" aria-checked={ativo} aria-label="Item ativo" onClick={() => setAtivo((v) => !v)} style={{ padding: 12, display: 'grid', placeItems: 'center', minWidth: 44, minHeight: 44 }}><span className="switch" aria-checked={ativo} /></button>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valido || salvando}><Icone nome="check" />{salvando ? 'Salvando…' : item ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </form>
    </Folha>
  )
}
