import { useEffect, useState } from 'react'
import type { Alerta, Config } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { moeda } from '../../util/formato'
import { Icone } from '../Icone'
import { Folha } from '../Folha'
import { Carregando } from '../Carregando'
import { BotaoCopiar, Campo, Interruptor, useAcao } from './comuns'

const ROTINAS: Array<{ chave: 'rotina_vigia' | 'rotina_quinzenal' | 'rotina_fechamento'; icone: string; nome: string; descricao: string }> = [
  { chave: 'rotina_vigia', icone: 'bell', nome: 'Vigia diário', descricao: 'Gasto fora do padrão, cobrança duplicada, assinatura nova, conta perto do vencimento.' },
  { chave: 'rotina_quinzenal', icone: 'trending-up', nome: 'Análise quinzenal', descricao: 'Tendências por categoria antes de virarem problema.' },
  { chave: 'rotina_fechamento', icone: 'calendar', nome: 'Fechamento do mês', descricao: 'Relatório do mês, projeção dos próximos 3 meses e pauta da reunião da família — dia 1º.' },
]

const TIPOS_ALERTA: Array<{ id: Alerta['tipo']; nome: string; icone: string }> = [
  { id: 'categoria_acima', nome: 'Categoria acima de um valor no mês', icone: 'shopping-cart' },
  { id: 'grupo_acima', nome: 'Grupo acima de um valor no mês', icone: 'layout-grid' },
  { id: 'nova_assinatura', nome: 'Nova assinatura detectada', icone: 'tv' },
  { id: 'cobranca_duplicada', nome: 'Cobrança duplicada', icone: 'copy' },
  { id: 'fora_do_padrao', nome: 'Gasto fora do padrão', icone: 'triangle-alert' },
]

export function nomeAlerta(a: Alerta, nomes: { categoria?: string; grupo?: string }): string {
  switch (a.tipo) {
    case 'categoria_acima': return `${nomes.categoria ?? 'Categoria'} acima de ${moeda(a.limite)}/mês`
    case 'grupo_acima': return `${nomes.grupo ?? 'Grupo'} acima de ${moeda(a.limite)}/mês`
    case 'nova_assinatura': return 'Nova assinatura detectada'
    case 'cobranca_duplicada': return 'Cobrança duplicada'
    default: return a.limite ? `Gasto fora do padrão acima de ${moeda(a.limite)}` : 'Gasto fora do padrão'
  }
}

function FolhaAlerta({ alerta, aoFechar, aoSalvar, aoExcluir }: { alerta: Alerta; aoFechar: () => void; aoSalvar: (a: Alerta) => void; aoExcluir: (id: string) => void }) {
  const boot = useBoot()
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<Alerta>({ ...alerta })
  const categorias = boot.categorias.filter((c) => c.tipo === 'despesa' && c.ativa)
  const grupos = boot.grupos.filter((g) => g.tipo_id !== 't_projetos' && g.tipo_id !== 't_receitas').sort((a, b) => a.ordem - b.ordem)
  const nome = nomeAlerta(f, { categoria: categorias.find((c) => c.id === f.categoria_id)?.nome, grupo: grupos.find((g) => g.id === f.grupo_id)?.nome })
  const precisaLimite = f.tipo === 'categoria_acima' || f.tipo === 'grupo_acima'
  const salvar = () => rodar(async () => {
    if (f.tipo === 'categoria_acima' && !f.categoria_id) throw new Error('Escolha a categoria.')
    if (f.tipo === 'grupo_acima' && !f.grupo_id) throw new Error('Escolha o grupo.')
    if (precisaLimite && !(f.limite > 0)) throw new Error('Informe o limite.')
    aoSalvar(await api<Alerta>('salvar_alerta', { alerta: { ...f, nome } }))
    aoFechar()
  }, 'Alerta salvo.')
  const excluir = () => rodar(async () => { await api('excluir_alerta', { id: f.id }); aoExcluir(f.id); aoFechar() }, 'Alerta excluído.')
  const alternarPessoa = (id: string) => setF({ ...f, avisar: f.avisar.includes(id) ? f.avisar.filter((x) => x !== id) : [...f.avisar, id] })
  return (
    <Folha aberta aoFechar={aoFechar} titulo={alerta.id ? 'Editar alerta' : 'Novo alerta'}>
      <p style={{ fontSize: 13, margin: '0 0 12px' }}>Nome: <b>{nome}</b></p>
      <Campo rotulo="Tipo">
        <select className="campo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Alerta['tipo'] })}>{TIPOS_ALERTA.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
      </Campo>
      {f.tipo === 'categoria_acima' && (
        <Campo rotulo="Categoria">
          <select className="campo" value={f.categoria_id ?? ''} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
            <option value="">Escolha…</option>
            {grupos.map((g) => <optgroup key={g.id} label={g.nome}>{categorias.filter((c) => c.grupo_id === g.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</optgroup>)}
          </select>
        </Campo>
      )}
      {f.tipo === 'grupo_acima' && (
        <Campo rotulo="Grupo"><select className="campo" value={f.grupo_id ?? ''} onChange={(e) => setF({ ...f, grupo_id: e.target.value })}><option value="">Escolha…</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></Campo>
      )}
      {(precisaLimite || f.tipo === 'fora_do_padrao') && (
        <Campo rotulo={precisaLimite ? 'Limite mensal (R$)' : 'Só avisar acima de (R$, opcional)'}><input className="campo num" type="number" inputMode="decimal" min={0} step="1" value={f.limite || ''} onChange={(e) => setF({ ...f, limite: Number(e.target.value) })} /></Campo>
      )}
      <Campo rotulo="Avisar quem" ajuda="Ninguém marcado = avisar todos os adultos.">
        <div className="flex flex-wrap gap-2">
          {boot.usuarios.filter((u) => u.ativo).map((u) => <button key={u.id} type="button" className="chip" style={{ minHeight: 44 }} aria-pressed={f.avisar.includes(u.id)} onClick={() => alternarPessoa(u.id)}>{u.apelido}</button>)}
        </div>
      </Campo>
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Alerta ativo</b></div><Interruptor ligado={f.ativo} aoMudar={(ativo) => setF({ ...f, ativo })} rotulo="Alerta ativo" /></div>
      </div>
      <div className="flex gap-2 justify-between flex-wrap">
        {alerta.id ? <button className="btn btn-danger" disabled={ocupado} onClick={excluir}><Icone nome="trash-2" />Excluir</button> : <span />}
        <span className="flex gap-2">
          <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
        </span>
      </div>
    </Folha>
  )
}

function Telegram({ config, salvarConfig, ocupado }: { config: Config; salvarConfig: (c: Partial<Config>) => Promise<unknown>; ocupado: boolean }) {
  const { rodar, ocupado: vinculando } = useAcao()
  const [vinculo, setVinculo] = useState<{ codigo: string; url_bot: string } | null>(null)
  const vincular = () => rodar(async () => setVinculo(await api('vincular_telegram')))
  return (
    <div className="card">
      <h3>Telegram <span className="sub">bot gratuito da família</span></h3>
      <div className="rows">
        <div className="row" style={{ minHeight: 52 }}>
          <span className="ico-sm"><Icone nome="send" /></span>
          <div className="t"><b>Avisos pelo Telegram</b><small>Lance por mensagem ou foto e receba os avisos das rotinas no chat.</small></div>
          <Interruptor ligado={!!config.telegram_ativo} aoMudar={(v) => salvarConfig({ telegram_ativo: v })} rotulo="Avisos pelo Telegram" desabilitado={ocupado} />
        </div>
      </div>
      <button className="btn btn-ghost mt-3" disabled={vinculando} onClick={vincular}><Icone nome="send" />Vincular meu Telegram</button>
      {vinculo && (
        <div className="mt-3">
          <div className="rows">
            <div className="row"><span className="ico-sm num">1</span><div className="t"><b>Abra o bot</b><small><a href={vinculo.url_bot} target="_blank" rel="noreferrer" style={{ color: 'var(--sel)' }}>{vinculo.url_bot}</a></small></div></div>
            <div className="row"><span className="ico-sm num">2</span><div className="t"><b>Envie o comando</b><small className="num" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>/start {vinculo.codigo}</small></div><BotaoCopiar texto={`/start ${vinculo.codigo}`} /></div>
            <div className="row"><span className="ico-sm num">3</span><div className="t"><b>Pronto</b><small>O chat fica vinculado a você. O código vale por 15 minutos.</small></div></div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Rotinas() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const { rodar, ocupado } = useAcao()
  const [alertas, setAlertas] = useState<Alerta[] | null>(null)
  const [editando, setEditando] = useState<Alerta | null>(null)
  const [horario, setHorario] = useState(boot.config.lembrete_horario || '20:00')
  const [email, setEmail] = useState((boot.config as Config & { email_resumo?: string }).email_resumo ?? '')
  const ehAdmin = boot.usuario.perfil === 'Administrador'

  useEffect(() => { api<Alerta[]>('listar_alertas').then(setAlertas).catch(() => setAlertas([])) }, [])

  const salvarConfig = (c: Partial<Config>) => rodar(async () => atualizarConfig(await api<Config>('salvar_config', { config: c })))
  const nomes = (a: Alerta) => ({ categoria: boot.categorias.find((c) => c.id === a.categoria_id)?.nome, grupo: boot.grupos.find((g) => g.id === a.grupo_id)?.nome })
  const quem = (a: Alerta) => (a.avisar.length ? `Avisar ${a.avisar.map((id) => boot.usuarios.find((u) => u.id === id)?.apelido ?? '?').join(' e ')}` : 'Avisar todos')

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Rotinas automáticas <span className="sub">gatilhos do Apps Script</span></h3>
          {ROTINAS.map((r) => (
            <div key={r.chave} className="routine">
              <div className="ico"><Icone nome={r.icone} /></div>
              <b>{r.nome}</b>
              <Interruptor ligado={boot.config[r.chave] !== false} aoMudar={(v) => salvarConfig({ [r.chave]: v })} rotulo={r.nome} desabilitado={ocupado || !ehAdmin} />
              <small>{r.descricao}</small>
            </div>
          ))}
          <hr className="divisor" />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Campo rotulo="Horário do lembrete diário" ajuda="“Lance os gastos de hoje” e os avisos do vigia.">
              <input className="campo num" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} disabled={!ehAdmin} />
            </Campo>
            <Campo rotulo="E-mail do resumo" ajuda="Recebe o fechamento do mês e a pauta da reunião.">
              <input className="campo" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="familia@exemplo.com" disabled={!ehAdmin} />
            </Campo>
          </div>
          {ehAdmin && <button className="btn btn-primary" disabled={ocupado} onClick={() => salvarConfig({ lembrete_horario: horario, ...({ email_resumo: email } as Partial<Config>) }).then(() => useSessao.getState().avisar('Rotinas salvas.', { tipo: 'ok' }))}><Icone nome="check" />Salvar</button>}
        </div>
        <Telegram config={boot.config} salvarConfig={salvarConfig} ocupado={ocupado || !ehAdmin} />
      </div>

      <div className="card">
        <h3>Alertas personalizados <span className="sub">regras simples, avisadas pelo vigia</span></h3>
        {alertas === null ? <Carregando texto="Lendo os alertas…" /> : (
          <div className="rows">
            {alertas.map((a) => (
              <button key={a.id} className="row" style={{ minHeight: 56 }} onClick={() => setEditando(a)}>
                <span className="ico-sm"><Icone nome={a.tipo === 'categoria_acima' ? (boot.categorias.find((c) => c.id === a.categoria_id)?.icone ?? 'shopping-cart') : TIPOS_ALERTA.find((t) => t.id === a.tipo)?.icone ?? 'bell'} /></span>
                <span className="t"><b>{a.nome || nomeAlerta(a, nomes(a))}</b><small>{quem(a)}</small></span>
                <span className={`tag ${!a.ativo ? 'proj' : a.status_atual === 'disparado' ? 'red' : a.percentual_atual != null ? 'ok' : 'proj'}`}>{!a.ativo ? 'desligado' : a.status_atual === 'disparado' ? 'disparado' : a.percentual_atual != null ? `${a.percentual_atual}%` : 'ativo'}</span>
                <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
              </button>
            ))}
            {!alertas.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum alerta ainda. Exemplo: “Delivery acima de R$ 400/mês → avisar Luiz e Nina”.</p>}
          </div>
        )}
        <button className="btn btn-primary mt-3" onClick={() => setEditando({ id: '', nome: '', tipo: 'categoria_acima', limite: 0, avisar: [], ativo: true })}><Icone nome="plus" />Novo alerta</button>
      </div>
      {editando && alertas && (
        <FolhaAlerta alerta={editando} aoFechar={() => setEditando(null)}
          aoSalvar={(a) => setAlertas(alertas.some((x) => x.id === a.id) ? alertas.map((x) => (x.id === a.id ? a : x)) : [...alertas, a])}
          aoExcluir={(id) => setAlertas(alertas.filter((x) => x.id !== id))} />
      )}
    </div>
  )
}
