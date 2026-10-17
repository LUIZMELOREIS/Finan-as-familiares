/**
 * Conselho da família (/conselho): propostas, votos e decisões.
 * Abas Abertas | Encerradas, placar Sim/Não/Abstenções, voto com comentário,
 * encerramento pelo administrador (regra de votação) e folha "Nova proposta".
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import { Avatar } from '../componentes/Avatar'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Icone } from '../componentes/Icone'
import { AcaoCelular, AcoesTopbar } from '../componentes/familia/AcaoCelular'
import { lerValorBr, brl, diasAte, placar } from '../componentes/familia/calculos'
import { useBoot, useSessao, usuarioPorId } from '../store/sessao'
import type { Decisao, TipoDecisao, Voto } from '../tipos'
import { dataBr, hojeIso, moeda } from '../util/formato'

const ICONE_TIPO: Record<TipoDecisao, string> = { 'novo projeto': 'target', 'gasto grande': 'banknote', 'ajuste de orçamento': 'scale' }
const NOME_TIPO: Record<TipoDecisao, string> = { 'novo projeto': 'Novo projeto', 'gasto grande': 'Gasto grande', 'ajuste de orçamento': 'Ajuste de orçamento' }
const OPCOES_VOTO: Array<{ v: Voto; r: string; i: string }> = [{ v: 'sim', r: 'Sim', i: 'thumbs-up' }, { v: 'não', r: 'Não', i: 'thumbs-down' }, { v: 'abster', r: 'Me abstenho', i: 'minus-circle' }]
const NOME_VOTO: Record<Voto, string> = { sim: 'Sim', 'não': 'Não', abster: 'Abstenção' }

export default function Conselho() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [decisoes, setDecisoes] = useState<Decisao[] | null>(null)
  const [aba, setAba] = useState<'abertas' | 'encerradas'>('abertas')
  const [nova, setNova] = useState(false)

  const carregar = useCallback(async () => {
    try { setDecisoes(await api<Decisao[]>('listar_decisoes')) } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível carregar as decisões.', { tipo: 'erro' }); setDecisoes([]) }
  }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  const abertas = (decisoes ?? []).filter((d) => d.status === 'aberta').sort((a, b) => a.prazo.localeCompare(b.prazo))
  const encerradas = (decisoes ?? []).filter((d) => d.status !== 'aberta').sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  const lista = aba === 'abertas' ? abertas : encerradas
  const regra = boot.config.regra_votacao === 'maioria_mais_pais' ? 'maioria simples com aprovação dos administradores' : 'maioria simples'

  return (
    <>
      <Cabecalho titulo="Conselho da família" subtitulo="Propostas, votos e decisões."
        acoes={<AcoesTopbar><button className="btn btn-primary" onClick={() => setNova(true)}><Icone nome="circle-plus" />Nova proposta</button></AcoesTopbar>} />

      {boot.config.fe_ativa !== false && (
        <p className="verse" style={{ marginBottom: 14 }}>“Sem conselho os projetos saem vãos, mas, com a multidão de conselheiros, se confirmarão.”<b>Provérbios 15.22</b></p>
      )}

      <div className="tabs" role="tablist" aria-label="Decisões">
        <button role="tab" aria-selected={aba === 'abertas'} onClick={() => setAba('abertas')}>Abertas{abertas.length ? ` · ${abertas.length}` : ''}</button>
        <button role="tab" aria-selected={aba === 'encerradas'} onClick={() => setAba('encerradas')}>Encerradas{encerradas.length ? ` · ${encerradas.length}` : ''}</button>
      </div>

      {decisoes === null ? <Carregando texto="Carregando as decisões…" /> : lista.length === 0 ? (
        <Vazio icone="vote" titulo={aba === 'abertas' ? 'Nenhuma votação aberta' : 'Nenhuma decisão encerrada'} texto={aba === 'abertas' ? 'Quando alguém propuser um projeto ou um gasto grande, a votação aparece aqui.' : 'As decisões aprovadas ou recusadas ficam guardadas aqui.'}>
          {aba === 'abertas' && <button className="btn btn-primary" onClick={() => setNova(true)}><Icone nome="circle-plus" />Nova proposta</button>}
        </Vazio>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2 items-start">
          {lista.map((d) => <CardDecisao key={d.id} decisao={d} regra={regra} aoMudar={(nd) => setDecisoes((ds) => (ds ?? []).map((x) => (x.id === nd.id ? nd : x)))} />)}
        </div>
      )}

      {lista.length > 0 && <AcaoCelular><button className="btn btn-primary btn-block" onClick={() => setNova(true)}><Icone nome="circle-plus" />Nova proposta</button></AcaoCelular>}

      <p className="sub" style={{ marginTop: 14 }}>Regra em vigor: {regra}. Gastos acima de {moeda(boot.config.valor_gasto_grande)} passam pelo Conselho. <Link to="/configuracoes" style={{ color: 'var(--sel)' }}>Alterar em Configurações</Link>.</p>

      <FolhaProposta aberta={nova} aoFechar={() => setNova(false)} aoSalvar={() => { setNova(false); setAba('abertas'); carregar() }} />
    </>
  )
}

function CardDecisao({ decisao: d, regra, aoMudar }: { decisao: Decisao; regra: string; aoMudar: (d: Decisao) => void }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const eu = boot.usuario
  const membros = boot.usuarios.filter((u) => u.ativo)
  const autor = usuarioPorId(boot.usuarios, d.criado_por)
  const p = placar(d, membros)
  const meuVoto = d.votos?.find((v) => v.usuario_id === eu.id)
  const [voto, setVoto] = useState<Voto | null>(meuVoto?.voto ?? null)
  const [comentario, setComentario] = useState(meuVoto?.comentario ?? '')
  const [ocupado, setOcupado] = useState(false)
  const aberta = d.status === 'aberta'
  const dias = diasAte(d.prazo)
  const comentarios = (d.votos ?? []).filter((v) => v.comentario.trim())
  const barra = (n: number) => `${p.total ? (n / p.total) * 100 : 0}%`

  const votar = async () => {
    if (!voto || ocupado) return
    setOcupado(true)
    try {
      const nd = await api<Decisao>('votar', { decisao_id: d.id, voto, comentario: comentario.trim() })
      aoMudar(nd)
      avisar('Voto registrado.', { tipo: 'ok' })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível votar.', { tipo: 'erro' }) } finally { setOcupado(false) }
  }
  const encerrar = async () => {
    if (ocupado || !window.confirm(`Encerrar a votação agora? Será aplicada a regra: ${regra}.`)) return
    setOcupado(true)
    try {
      const nd = await api<Decisao>('encerrar_decisao', { decisao_id: d.id })
      aoMudar(nd)
      avisar(nd.status === 'aprovada' ? 'Votação encerrada: proposta aprovada.' : 'Votação encerrada: proposta recusada.', { tipo: 'ok' })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível encerrar.', { tipo: 'erro' }) } finally { setOcupado(false) }
  }

  return (
    <article className="card" aria-labelledby={`dec-${d.id}`}>
      <h3 id={`dec-${d.id}`}>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span className="ico-sm"><Icone nome={ICONE_TIPO[d.tipo] ?? 'vote'} /></span>
          <span style={{ whiteSpace: 'normal' }}>{d.titulo}</span>
        </span>
        {aberta ? (
          <span className={`tag ${dias < 0 ? 'red' : dias <= 2 ? 'warn' : 'proj'}`}>{dias < 0 ? `Vencida há ${-dias} dia${dias === -1 ? '' : 's'}` : dias === 0 ? 'Encerra hoje' : `${dias} dia${dias === 1 ? '' : 's'}`}</span>
        ) : <span className={`tag ${d.status === 'aprovada' ? 'ok' : 'red'}`}>{d.status === 'aprovada' ? 'Aprovada' : 'Recusada'}</span>}
      </h3>
      {d.descricao && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)' }}>{d.descricao}</p>}
      <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        <span className="flex items-center gap-2"><Avatar usuario={autor} tamanho={22} />proposto por <b style={{ color: 'var(--text)', fontWeight: 500 }}>{autor?.apelido ?? '—'}</b></span>
        <span className="num">{NOME_TIPO[d.tipo]}{d.valor ? ` · ${brl(d.valor)}` : ''}</span>
        <span className="num">prazo {dataBr(d.prazo)}</span>
        {d.projeto_id && <Link to={`/projetos/${d.projeto_id}`} style={{ color: 'var(--sel)' }}>ver projeto</Link>}
      </div>

      <div className="hbars" style={{ marginBottom: 12 }}>
        {[{ r: 'Sim', n: p.sim, c: 'var(--green)', v: 'sim' as Voto }, { r: 'Não', n: p.nao, c: 'var(--red)', v: 'não' as Voto }, { r: 'Abstenções', n: p.abst, c: 'var(--slate)', v: 'abster' as Voto }].map((l) => (
          <div className="hb" key={l.r} style={{ gridTemplateColumns: '78px 1fr' }}>
            <span className="lbl">{l.r}</span>
            <div className="track">
              <div className="fill" style={{ flex: `0 0 ${barra(l.n)}`, background: l.c, minWidth: l.n ? 6 : 0 }} />
              <span className="num">{l.n}</span>
              <span className="flex gap-1">{(d.votos ?? []).filter((v) => v.voto === l.v).map((v) => <Avatar key={v.usuario_id} usuario={usuarioPorId(boot.usuarios, v.usuario_id)} tamanho={20} />)}</span>
            </div>
          </div>
        ))}
        {aberta && p.aguardando.length > 0 && (
          <div className="hb" style={{ gridTemplateColumns: '78px 1fr' }}>
            <span className="lbl">Aguardando</span>
            <div className="track"><span className="flex gap-1">{p.aguardando.map((id) => <Avatar key={id} usuario={usuarioPorId(boot.usuarios, id)} tamanho={20} />)}</span><span>{p.aguardando.map((id) => usuarioPorId(boot.usuarios, id)?.apelido).filter(Boolean).join(', ')}</span></div>
          </div>
        )}
      </div>

      {comentarios.length > 0 && (
        <div className="rows" style={{ marginBottom: 12 }}>
          {comentarios.map((v) => {
            const u = usuarioPorId(boot.usuarios, v.usuario_id)
            return (
              <div className="row" key={v.usuario_id} style={{ padding: '7px 0' }}>
                <Avatar usuario={u} tamanho={26} />
                <div className="t"><b style={{ whiteSpace: 'normal' }}>{v.comentario}</b><small>{u?.apelido} · votou {NOME_VOTO[v.voto].toLowerCase()} em {dataBr(v.data.slice(0, 10))}</small></div>
              </div>
            )
          })}
        </div>
      )}

      {aberta ? (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="rotulo" style={{ marginBottom: 6 }}>{meuVoto ? <>Seu voto: <b style={{ color: 'var(--text)' }}>{NOME_VOTO[meuVoto.voto]}</b> · pode mudar até o prazo</> : 'Seu voto'}</div>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} role="radiogroup" aria-label="Seu voto">
            {OPCOES_VOTO.map((o) => <button key={o.v} role="radio" aria-checked={voto === o.v} aria-pressed={voto === o.v} onClick={() => setVoto(o.v)} className="flex items-center justify-center gap-1.5"><Icone nome={o.i} tamanho={16} />{o.r}</button>)}
          </div>
          <div className="flex gap-2 items-center" style={{ marginTop: 8 }}>
            <input className="campo" placeholder="Comentário (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={140} aria-label="Comentário do voto" />
            <button className="btn btn-primary" onClick={votar} disabled={!voto || ocupado || (meuVoto?.voto === voto && meuVoto.comentario === comentario.trim())}><Icone nome="check" />{meuVoto ? 'Atualizar' : 'Votar'}</button>
          </div>
          {eu.perfil === 'Administrador' && (
            <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: 10 }}>
              <span className="sub">Regra: {regra}.</span>
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={encerrar} disabled={ocupado}><Icone nome="lock" />Encerrar votação</button>
            </div>
          )}
        </div>
      ) : (
        <p className="sub" style={{ margin: 0 }}>Encerrada com {p.sim} sim, {p.nao} não e {p.abst} abstenç{p.abst === 1 ? 'ão' : 'ões'}{meuVoto ? ` · seu voto: ${NOME_VOTO[meuVoto.voto].toLowerCase()}` : ''}.</p>
      )}
    </article>
  )
}

function FolhaProposta({ aberta, aoFechar, aoSalvar }: { aberta: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [tipo, setTipo] = useState<TipoDecisao>('gasto grande')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) })
  const [salvando, setSalvando] = useState(false)
  const valido = titulo.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(prazo)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!valido || salvando) return
    setSalvando(true)
    try {
      await api('salvar_decisao', { decisao: { titulo: titulo.trim(), descricao: descricao.trim(), tipo, valor: lerValorBr(valor), prazo, status: 'aberta' } })
      avisar('Proposta aberta para votação.', { tipo: 'ok' })
      setTitulo(''); setDescricao(''); setValor('')
      aoSalvar()
    } catch (err) { avisar(err instanceof Error ? err.message : 'Não foi possível salvar a proposta.', { tipo: 'erro' }) } finally { setSalvando(false) }
  }
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Nova proposta">
      <form onSubmit={enviar} noValidate>
        <div className="field">
          <span className="rotulo">Tipo</span>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} role="radiogroup" aria-label="Tipo da proposta">
            {(Object.keys(NOME_TIPO) as TipoDecisao[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tipo === t} aria-pressed={tipo === t} onClick={() => setTipo(t)} className="flex items-center justify-center gap-1.5"><Icone nome={ICONE_TIPO[t]} tamanho={16} />{NOME_TIPO[t]}</button>)}
          </div>
          {tipo === 'novo projeto' && <p className="sub" style={{ margin: 0 }}>Para um projeto com meta e data, prefira <Link to="/projetos" style={{ color: 'var(--sel)' }}>Propor projeto</Link> com a opção "Levar ao Conselho".</p>}
        </div>
        <div className="field"><label htmlFor="pr-titulo">Título</label><input id="pr-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Trocar a geladeira" autoFocus maxLength={80} /></div>
        <div className="field"><label htmlFor="pr-desc">Descrição</label><textarea id="pr-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que é, por que agora e como pagar." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><label htmlFor="pr-valor">Valor (R$)</label><input id="pr-valor" className="num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="pr-prazo">Prazo da votação</label><input id="pr-prazo" type="date" min={hojeIso()} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
        </div>
        {lerValorBr(valor) >= boot.config.valor_gasto_grande && tipo === 'gasto grande' && <p className="sub" style={{ margin: '0 0 12px' }}>Acima de {moeda(boot.config.valor_gasto_grande)}: este gasto precisa da decisão do Conselho.</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valido || salvando}><Icone nome="vote" />{salvando ? 'Abrindo…' : 'Abrir votação'}</button>
        </div>
      </form>
    </Folha>
  )
}
