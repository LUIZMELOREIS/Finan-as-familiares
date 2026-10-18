/**
 * Card "Alertas personalizados": "Delivery acima de R$ 400/mês → avisar Luiz e
 * Nina". Lista com estado (disparado / NN% / ativo) e folha para criar, editar
 * e excluir.
 */
import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import type { Alerta } from '../../tipos'
import { useBoot, useSessao } from '../../store/sessao'
import { Carregando } from '../Carregando'
import { Folha } from '../Folha'
import { Icone } from '../Icone'

type TipoAlerta = Alerta['tipo']
const TIPOS: Array<{ id: TipoAlerta; nome: string }> = [
  { id: 'categoria_acima', nome: 'Categoria acima de um valor no mês' },
  { id: 'grupo_acima', nome: 'Grupo acima de um valor no mês' },
  { id: 'nova_assinatura', nome: 'Nova assinatura detectada' },
  { id: 'cobranca_duplicada', nome: 'Cobrança duplicada' },
  { id: 'fora_do_padrao', nome: 'Gasto fora do padrão' },
]
const NOME_FIXO: Partial<Record<TipoAlerta, string>> = { nova_assinatura: 'Nova assinatura detectada', cobranca_duplicada: 'Cobrança duplicada', fora_do_padrao: 'Gasto fora do padrão' }
const ICONE_TIPO: Partial<Record<TipoAlerta, string>> = { nova_assinatura: 'tv', cobranca_duplicada: 'repeat', fora_do_padrao: 'triangle-alert', grupo_acima: 'list-checks' }

const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`

function nomesDe(ids: string[], usuarios: Array<{ id: string; apelido: string }>): string {
  const n = ids.map((id) => usuarios.find((u) => u.id === id)?.apelido).filter((x): x is string => !!x)
  if (!n.length) return 'todos'
  if (n.length === 1) return n[0]
  return `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`
}

export function TagAlerta({ a }: { a: Alerta }) {
  if (!a.ativo) return <span className="tag proj">pausado</span>
  if (a.status_atual === 'disparado') return <span className="tag red">disparado</span>
  if (a.percentual_atual != null && (a.tipo === 'categoria_acima' || a.tipo === 'grupo_acima')) return <span className={`tag ${a.percentual_atual >= 80 ? 'warn' : 'ok'} num`}>{a.percentual_atual}%</span>
  return <span className="tag proj">ativo</span>
}

export function Alertas() {
  const { categorias, grupos, usuarios } = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [alertas, setAlertas] = useState<Alerta[] | null>(null)
  const [edicao, setEdicao] = useState<Alerta | null>(null)

  useEffect(() => {
    let vivo = true
    api<Alerta[]>('listar_alertas').then((a) => vivo && setAlertas(a)).catch(() => vivo && setAlertas([]))
    return () => { vivo = false }
  }, [])

  function iconeDe(a: Alerta) {
    if (a.tipo === 'categoria_acima') return categorias.find((c) => c.id === a.categoria_id)?.icone ?? 'receipt'
    return ICONE_TIPO[a.tipo] ?? 'bell'
  }

  function novo(): Alerta {
    return { id: '', nome: '', tipo: 'categoria_acima', categoria_id: 'c_delivery', limite: 400, avisar: [], ativo: true }
  }

  return (
    <div className="card">
      <h3>Alertas personalizados <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdicao(novo())}><Icone nome="plus" />Novo alerta</button></h3>
      {alertas === null ? <Carregando texto="Carregando alertas…" /> : alertas.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhum alerta ainda. Crie regras como “Delivery acima de R$ 400/mês → avisar Luiz e Nina”.</p>
      ) : (
        <div className="rows">
          {alertas.map((a) => (
            <button key={a.id} type="button" className="row" onClick={() => setEdicao(a)} aria-label={`Editar alerta ${a.nome}`}>
              <div className="ico-sm" aria-hidden="true"><Icone nome={iconeDe(a)} /></div>
              <div className="t"><b>{a.nome}</b><small>Avisar {nomesDe(a.avisar, usuarios)}</small></div>
              <TagAlerta a={a} />
            </button>
          ))}
        </div>
      )}
      <FolhaAlerta
        alerta={edicao}
        aoFechar={() => setEdicao(null)}
        aoSalvar={(a) => { setAlertas((lista) => { const l = lista ?? []; const i = l.findIndex((x) => x.id === a.id); return i >= 0 ? l.map((x) => (x.id === a.id ? a : x)) : [...l, a] }); setEdicao(null); avisar('Alerta salvo', { tipo: 'ok' }) }}
        aoExcluir={(id) => { setAlertas((lista) => (lista ?? []).filter((x) => x.id !== id)); setEdicao(null); avisar('Alerta excluído', { tipo: 'info' }) }}
        categorias={categorias}
        grupos={grupos}
        usuarios={usuarios}
      />
    </div>
  )
}

function FolhaAlerta({ alerta, aoFechar, aoSalvar, aoExcluir, categorias, grupos, usuarios }: {
  alerta: Alerta | null
  aoFechar: () => void
  aoSalvar: (a: Alerta) => void
  aoExcluir: (id: string) => void
  categorias: ReturnType<typeof useBoot>['categorias']
  grupos: ReturnType<typeof useBoot>['grupos']
  usuarios: ReturnType<typeof useBoot>['usuarios']
}) {
  const avisar = useSessao((e) => e.avisar)
  const [a, setA] = useState<Alerta | null>(alerta)
  const [nomeManual, setNomeManual] = useState(false)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { setA(alerta); setNomeManual(!!alerta?.id) }, [alerta])
  if (!a) return null

  const despesas = categorias.filter((c) => c.tipo === 'despesa' && c.ativa !== false && !c.oculta_cardapio)
  const gruposDespesa = grupos.filter((g) => g.tipo_id === 't_fixas' || g.tipo_id === 't_variaveis')
  const nomeAuto = (x: Alerta) => {
    if (x.tipo === 'categoria_acima') return `${categorias.find((c) => c.id === x.categoria_id)?.nome ?? 'Categoria'} acima de ${reais(x.limite)}/mês`
    if (x.tipo === 'grupo_acima') return `${grupos.find((g) => g.id === x.grupo_id)?.nome ?? 'Grupo'} acima de ${reais(x.limite)}/mês`
    return NOME_FIXO[x.tipo] ?? ''
  }
  const m = (p: Partial<Alerta>) => setA((x) => { if (!x) return x; const n = { ...x, ...p }; return nomeManual ? n : { ...n, nome: nomeAuto(n) } })
  const comLimite = a.tipo === 'categoria_acima' || a.tipo === 'grupo_acima'
  const nome = a.nome || nomeAuto(a)

  async function salvar() {
    if (!a) return
    if (comLimite && !(a.limite > 0)) { avisar('Informe o limite mensal.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const salvo = await api<Alerta>('salvar_alerta', { alerta: { ...a, nome, categoria_id: a.tipo === 'categoria_acima' ? a.categoria_id : undefined, grupo_id: a.tipo === 'grupo_acima' ? a.grupo_id : undefined } })
      aoSalvar(salvo)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!a?.id) return
    try { await api('excluir_alerta', { id: a.id }); aoExcluir(a.id) } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível excluir', { tipo: 'erro' }) }
  }

  return (
    <Folha aberta={!!alerta} aoFechar={aoFechar} titulo={a.id ? 'Editar alerta' : 'Novo alerta'}>
      <div className="field">
        <label htmlFor="al-tipo">Tipo</label>
        <select id="al-tipo" value={a.tipo} onChange={(e) => m({ tipo: e.target.value as TipoAlerta, grupo_id: a.grupo_id ?? gruposDespesa[0]?.id })}>
          {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      {a.tipo === 'categoria_acima' && (
        <div className="field">
          <label htmlFor="al-cat">Categoria</label>
          <select id="al-cat" value={a.categoria_id ?? ''} onChange={(e) => m({ categoria_id: e.target.value })}>
            {despesas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}
      {a.tipo === 'grupo_acima' && (
        <div className="field">
          <label htmlFor="al-grupo">Grupo</label>
          <select id="al-grupo" value={a.grupo_id ?? ''} onChange={(e) => m({ grupo_id: e.target.value })}>
            {gruposDespesa.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
      )}
      {comLimite && (
        <div className="field">
          <label htmlFor="al-limite">Limite por mês (R$)</label>
          <input id="al-limite" className="num" inputMode="decimal" value={a.limite || ''} onChange={(e) => m({ limite: Number(e.target.value.replace(/\./g, '').replace(',', '.')) || 0 })} placeholder="400" />
        </div>
      )}
      <div className="field">
        <span className="rotulo">Avisar quem <span style={{ color: 'var(--faint)' }}>(ninguém marcado = todos)</span></span>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {usuarios.filter((u) => u.ativo).map((u) => {
            const marcado = a.avisar.includes(u.id)
            return (
              <button key={u.id} type="button" className="chip" style={{ minWidth: 0 }} aria-pressed={marcado} onClick={() => m({ avisar: marcado ? a.avisar.filter((x) => x !== u.id) : [...a.avisar, u.id] })}>
                <Icone nome={marcado ? 'circle-check' : 'user-round'} tamanho={17} /><span>{u.apelido}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="field">
        <label htmlFor="al-nome">Nome do alerta</label>
        <input id="al-nome" value={nome} onChange={(e) => { setNomeManual(true); setA((x) => (x ? { ...x, nome: e.target.value } : x)) }} />
      </div>
      <div className="routine" style={{ borderTop: 0, paddingTop: 0 }}>
        <div className="ico" aria-hidden="true"><Icone nome="bell" /></div>
        <b>Alerta ativo</b>
        <button type="button" className="switch" role="switch" aria-checked={a.ativo} aria-label={a.ativo ? 'Ativo' : 'Pausado'} onClick={() => m({ ativo: !a.ativo })} />
        <small>Pausado, o alerta fica guardado mas não avisa ninguém.</small>
      </div>
      <div className="flex" style={{ gap: 8, marginTop: 6 }}>
        {a.id && <button type="button" className="btn btn-danger" onClick={excluir}><Icone nome="trash-2" />Excluir</button>}
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={salvar} disabled={salvando}><Icone nome="check" />{salvando ? 'Salvando…' : 'Salvar alerta'}</button>
      </div>
    </Folha>
  )
}
