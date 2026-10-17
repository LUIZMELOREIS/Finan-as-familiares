import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Avatar } from '../componentes/familia/Avatar'
import { dataMaisDias, decidirResultado, diasRestantes, placar } from '../componentes/familia/calculos'
import { PROVERBIOS_15_22, versiculoPorReferencia } from '../componentes/familia/versiculos'
import { api } from '../api/cliente'
import { useBoot, useSessao, usuarioPorId } from '../store/sessao'
import { dataBr, hojeIso, lerValor, moeda } from '../util/formato'
import type { Decisao, Projeto, TipoDecisao, Voto } from '../tipos'

const TIPOS: Record<TipoDecisao, { icone: string; nome: string }> = {
  'novo projeto': { icone: '🆕', nome: 'Novo projeto' },
  'gasto grande': { icone: '💸', nome: 'Gasto grande' },
  'ajuste de orçamento': { icone: '⚖️', nome: 'Ajuste de orçamento' },
}

const VOTOS: Array<{ voto: Voto; icone: string; nome: string; classe: string }> = [
  { voto: 'sim', icone: '👍', nome: 'Sim', classe: 'botao-verde' },
  { voto: 'não', icone: '👎', nome: 'Não', classe: 'botao-perigo' },
  { voto: 'abster', icone: '🤷', nome: 'Me abstenho', classe: 'botao-secundario' },
]

function textoRegra(regra: 'maioria' | 'maioria_mais_pais') {
  return regra === 'maioria_mais_pais'
    ? 'Regra da família: maioria simples e nenhum administrador (pai/mãe) contra.'
    : 'Regra da família: maioria simples dos votos.'
}

function Barra({ rotulo, icone, n, total, cor, quem }: { rotulo: string; icone: string; n: number; total: number; cor: string; quem: Array<{ id: string }> }) {
  const boot = useBoot()
  const pct = total ? Math.round((n / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-sm font-semibold shrink-0"><span aria-hidden>{icone}</span> {rotulo}</span>
      <div className="progresso flex-1" style={{ height: 12 }} aria-label={`${rotulo}: ${n} de ${total}`}>
        <span style={{ width: `${pct}%`, background: cor }} />
      </div>
      <span className="w-6 text-right font-bold tabular-nums">{n}</span>
      <span className="flex -space-x-2 w-16 justify-end">
        {quem.slice(0, 3).map((q) => <Avatar key={q.id} usuario={usuarioPorId(boot.usuarios, q.id)} tamanho={24} />)}
      </span>
    </div>
  )
}

function CartaoDecisao({ d, aoAtualizar }: { d: Decisao; aoAtualizar: (d: Decisao) => void }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarProjetos = useSessao((e) => e.atualizarProjetos)
  const [comentario, setComentario] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const votos = d.votos ?? []
  const p = placar(votos)
  const meuVoto = votos.find((v) => v.usuario_id === boot.usuario.id)
  const autor = usuarioPorId(boot.usuarios, d.criado_por)
  const dias = diasRestantes(d.prazo, hojeIso())
  const aberta = d.status === 'aberta'
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const tipo = TIPOS[d.tipo] ?? { icone: '📌', nome: d.tipo }
  const quem = (v: Voto) => votos.filter((x) => x.voto === v).map((x) => ({ id: x.usuario_id }))
  const admins = boot.usuarios.filter((u) => u.perfil === 'Administrador').map((u) => u.id)
  const previa = decidirResultado(votos, admins, boot.config.regra_votacao)

  const votar = async (voto: Voto) => {
    setOcupado(true)
    try {
      const nova = await api<Decisao>('votar', { decisao_id: d.id, voto, comentario: comentario.trim() })
      aoAtualizar(nova)
      setComentario('')
      avisar(meuVoto ? 'Voto alterado.' : 'Voto registrado. Obrigado por participar!', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível votar', { tipo: 'erro' })
    } finally {
      setOcupado(false)
    }
  }

  const encerrar = async () => {
    if (!window.confirm(`Encerrar a votação "${d.titulo}"? Pela regra atual o resultado será: ${previa === 'aprovada' ? 'APROVADA' : 'RECUSADA'}.`)) return
    setOcupado(true)
    try {
      const nova = await api<Decisao>('encerrar_decisao', { decisao_id: d.id })
      aoAtualizar(nova)
      if (nova.projeto_id) atualizarProjetos(await api<Projeto[]>('listar_projetos'))
      avisar(nova.status === 'aprovada' ? '✅ Decisão aprovada pela família.' : 'Decisão recusada. Tudo bem — a família decidiu junta.', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível encerrar', { tipo: 'erro' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <article className={`card p-4 space-y-3 ${!aberta ? 'opacity-95' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0" aria-hidden>{tipo.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-suave font-semibold uppercase tracking-wide">{tipo.nome}</span>
            {!aberta && (
              <span className={`text-xs font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${d.status === 'aprovada' ? 'bg-verde text-white' : 'bg-vermelho text-white'}`}>
                {d.status === 'aprovada' ? '✅ Aprovada' : '❌ Recusada'}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold leading-tight">{d.titulo}</h2>
          {d.descricao && <p className="text-suave mt-1 leading-snug">{d.descricao}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {d.valor > 0 && <span className="font-bold text-base">{moeda(d.valor)}</span>}
        <span className="flex items-center gap-1.5 text-suave"><Avatar usuario={autor} tamanho={22} /> {autor?.apelido ?? 'Membro'} propôs</span>
        {aberta ? (
          <span className={`font-semibold ${dias < 0 ? 'text-vermelho' : dias <= 2 ? 'text-amarelo' : 'text-suave'}`}>
            ⏳ {dias < 0 ? `Venceu há ${-dias} dia${-dias === 1 ? '' : 's'}` : dias === 0 ? 'Último dia' : `${dias} dia${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}`}
          </span>
        ) : (
          <span className="text-suave">Prazo: {dataBr(d.prazo)}</span>
        )}
        {d.projeto_id && <Link to={`/sonhos/${d.projeto_id}`} className="text-primaria-sel font-semibold">✈️ Ver o sonho</Link>}
      </div>

      <div className="space-y-2">
        <Barra rotulo="Sim" icone="👍" n={p.sim} total={p.total} cor="var(--verde)" quem={quem('sim')} />
        <Barra rotulo="Não" icone="👎" n={p.nao} total={p.total} cor="var(--vermelho)" quem={quem('não')} />
        <Barra rotulo="Abstenções" icone="🤷" n={p.abster} total={p.total} cor="var(--texto-suave)" quem={quem('abster')} />
      </div>

      {votos.some((v) => v.comentario) && (
        <ul className="space-y-1.5">
          {votos.filter((v) => v.comentario).map((v) => {
            const u = usuarioPorId(boot.usuarios, v.usuario_id)
            return (
              <li key={v.usuario_id} className="flex items-start gap-2 text-sm">
                <Avatar usuario={u} tamanho={22} />
                <span><strong>{u?.apelido ?? 'Membro'}</strong> ({v.voto === 'abster' ? 'abstenção' : v.voto}): {v.comentario}</span>
              </li>
            )
          })}
        </ul>
      )}

      {aberta ? (
        <div className="space-y-2 pt-1">
          {meuVoto && <p className="text-sm text-suave">Seu voto: <strong className="text-texto">{meuVoto.voto === 'abster' ? '🤷 Me abstenho' : meuVoto.voto === 'sim' ? '👍 Sim' : '👎 Não'}</strong>. Você pode trocar enquanto a votação estiver aberta.</p>}
          <input className="campo" placeholder="Comentário (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={140} aria-label="Comentário do voto" />
          <div className="grid grid-cols-3 gap-2">
            {VOTOS.map((v) => (
              <button key={v.voto} className={`botao ${v.classe} !min-h-14 flex-col !gap-0 ${meuVoto?.voto === v.voto ? 'ring-4 ring-amarelo' : ''}`} onClick={() => votar(v.voto)} disabled={ocupado} aria-pressed={meuVoto?.voto === v.voto}>
                <span className="text-2xl leading-none" aria-hidden>{v.icone}</span>
                <span className="text-sm">{v.nome}</span>
              </button>
            ))}
          </div>
          {ehAdmin && (
            <div className="pt-1">
              <button className="botao botao-amarelo w-full" onClick={encerrar} disabled={ocupado}>🔒 Encerrar votação</button>
              <p className="text-xs text-suave mt-1">{textoRegra(boot.config.regra_votacao)} Hoje daria: <strong>{previa === 'aprovada' ? 'aprovada' : 'recusada'}</strong>.</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-suave">{textoRegra(boot.config.regra_votacao)}</p>
      )}
    </article>
  )
}

export default function Conselho() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [decisoes, setDecisoes] = useState<Decisao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'abertas' | 'encerradas'>('abertas')
  const [novaAberta, setNovaAberta] = useState(false)
  const proverbio = versiculoPorReferencia(PROVERBIOS_15_22)

  const carregar = useCallback(async () => {
    const ds = await api<Decisao[]>('listar_decisoes')
    setDecisoes(ds)
  }, [])

  useEffect(() => {
    let vivo = true
    carregar()
      .catch((e) => avisar(e instanceof Error ? e.message : 'Não foi possível carregar o Conselho', { tipo: 'erro' }))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [carregar, avisar])

  const atualizar = (d: Decisao) => setDecisoes((ds) => ds.map((x) => (x.id === d.id ? d : x)))
  const abertas = decisoes.filter((d) => d.status === 'aberta').sort((a, b) => (a.prazo < b.prazo ? -1 : 1))
  const encerradas = decisoes.filter((d) => d.status !== 'aberta').sort((a, b) => (a.prazo > b.prazo ? -1 : 1))
  const lista = aba === 'abertas' ? abertas : encerradas

  return (
    <>
      <Cabecalho titulo="Conselho da Família" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {boot.config.fe_ativa && proverbio && (
          <p className="text-sm text-suave italic leading-relaxed px-1">“{proverbio.texto}” — {proverbio.referencia}</p>
        )}

        <button className="botao botao-primario w-full text-lg !min-h-14" onClick={() => setNovaAberta(true)}>📝 Nova proposta</button>

        <div className="grid grid-cols-2 gap-2 p-1 card" role="tablist">
          {(['abertas', 'encerradas'] as const).map((a) => (
            <button key={a} role="tab" aria-selected={aba === a} className={`botao ${aba === a ? 'botao-primario' : 'botao-fantasma'}`} onClick={() => setAba(a)}>
              {a === 'abertas' ? `🗳️ Abertas (${abertas.length})` : `📁 Encerradas (${encerradas.length})`}
            </button>
          ))}
        </div>

        {carregando ? (
          <Carregando texto="Reunindo o Conselho…" />
        ) : lista.length === 0 ? (
          <Vazio icone={aba === 'abertas' ? '🕊️' : '📁'} titulo={aba === 'abertas' ? 'Nenhuma votação aberta' : 'Nenhuma decisão encerrada'} texto={aba === 'abertas' ? 'Quando alguém propuser algo, a família vota aqui.' : 'As decisões encerradas ficam guardadas aqui.'} />
        ) : (
          <div className="space-y-4">{lista.map((d) => <CartaoDecisao key={d.id} d={d} aoAtualizar={atualizar} />)}</div>
        )}
      </div>

      <NovaProposta aberta={novaAberta} aoFechar={() => setNovaAberta(false)} aoCriada={(d) => { setDecisoes((ds) => [d, ...ds]); setAba('abertas') }} />
    </>
  )
}

function NovaProposta({ aberta, aoFechar, aoCriada }: { aberta: boolean; aoFechar: () => void; aoCriada: (d: Decisao) => void }) {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [tipo, setTipo] = useState<TipoDecisao>('gasto grande')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState(dataMaisDias(hojeIso(), 7))
  const [salvando, setSalvando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    setSalvando(true)
    try {
      const decisao: Decisao = { id: '', titulo: titulo.trim(), descricao: descricao.trim(), tipo, valor: lerValor(valor), criado_por: boot.usuario.id, criado_em: hojeIso(), prazo, status: 'aberta' }
      const d = await api<Decisao>('salvar_decisao', { decisao })
      aoCriada(d)
      avisar('Proposta enviada. A família já pode votar!', { tipo: 'ok' })
      setTitulo(''); setDescricao(''); setValor(''); setPrazo(dataMaisDias(hojeIso(), 7))
      aoFechar()
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível enviar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="📝 Nova proposta">
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <span className="rotulo">Tipo</span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TIPOS) as TipoDecisao[]).map((t) => (
              <button type="button" key={t} className={`botao !min-h-16 flex-col !gap-0 ${tipo === t ? 'botao-primario' : 'botao-secundario'}`} onClick={() => setTipo(t)} aria-pressed={tipo === t}>
                <span className="text-2xl leading-none" aria-hidden>{TIPOS[t].icone}</span>
                <span className="text-xs leading-tight text-center">{TIPOS[t].nome}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className="rotulo">Título</span><input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Trocar a geladeira" maxLength={80} required /></label>
        <label className="block"><span className="rotulo">Descrição</span><textarea className="campo min-h-24" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Por que isso é importante? Quanto custa? Como pagaríamos?" maxLength={400} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="rotulo">Valor (R$)</span><input className="campo" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></label>
          <label className="block"><span className="rotulo">Votar até</span><input className="campo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} required /></label>
        </div>
        <button type="submit" className="botao botao-primario w-full text-lg !min-h-14" disabled={salvando || !titulo.trim()}>{salvando ? '⏳ Enviando…' : '🗳️ Abrir a votação'}</button>
      </form>
    </Folha>
  )
}
