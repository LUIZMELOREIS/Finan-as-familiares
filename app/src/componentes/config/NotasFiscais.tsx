/**
 * Configurações → Notas fiscais: robô do Nota Paraná / Nota Curitibana
 * (docs/ROBO_NOTAS_FISCAIS.md). O administrador conecta cada adulto com CPF e
 * senha do portal (gravados só nas propriedades do Apps Script, nunca na planilha
 * nem devolvidos pela API), testa a conexão, roda o robô agora e ajusta os limites
 * de lançamento direto. Adultos veem o status e podem sincronizar as próprias notas.
 */
import { useEffect, useState } from 'react'
import type { Config, ConexaoNotas, FonteNota, ResultadoSincronizacao, ResultadoTesteNotas, StatusNotasFiscais, Usuario } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { dataBr, moeda } from '../../util/formato'
import { Icone } from '../Icone'
import { Avatar } from '../Avatar'
import { Folha } from '../Folha'
import { Carregando } from '../Carregando'
import { Campo, Interruptor, useAcao } from './comuns'

const FONTES: Array<{ id: FonteNota; nome: string; usuario: string; ajuda: string; site: string }> = [
  { id: 'nota_parana', nome: 'Nota Paraná', usuario: 'CPF', ajuda: 'Mesma senha do portal notaparana.pr.gov.br (Identidade Digital do Paraná).', site: 'https://www.notaparana.pr.gov.br' },
  { id: 'nota_curitibana', nome: 'Nota Curitibana', usuario: 'CPF ou e-mail', ajuda: 'Login do e-Cidadão da Prefeitura de Curitiba. O portal pode pedir uma verificação que o robô não resolve sozinho.', site: 'https://notacuritibana.curitiba.pr.gov.br' },
]

const MOTIVO: Record<string, string> = {
  senha_invalida: 'CPF ou senha recusados pelo portal',
  bloqueado: 'o portal recusou a conexão vinda do Google (Plano B: coletor fora do Apps Script)',
  conexao_recusada: 'o portal não respondeu à conexão',
  desafio: 'o portal pediu uma verificação (captcha) que o robô não resolve',
  formulario_login: 'o portal voltou para a tela de login',
  sem_credencial: 'sem CPF e senha gravados',
  suspenso: 'robô suspenso depois de falhas seguidas',
}
const motivoTexto = (m?: string) => (m ? MOTIVO[m] ?? m.replace(/_/g, ' ') : '')
const quando = (iso: string) => (iso ? `${dataBr(iso.slice(0, 10))} ${iso.slice(11, 16)}`.trim() : 'nunca')

function FolhaConectar({ fonte, usuario, aoFechar, aoConectar }: { fonte: FonteNota; usuario: Usuario; aoFechar: () => void; aoConectar: () => void }) {
  const f = FONTES.find((x) => x.id === fonte)!
  const { rodar, ocupado } = useAcao()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const salvar = () => rodar(async () => {
    const l = login.trim()
    if (fonte === 'nota_parana' && l.replace(/\D/g, '').length !== 11) throw new Error('Informe o CPF com 11 dígitos.')
    if (!l) throw new Error(`Informe o ${f.usuario}.`)
    if (senha.length < 4) throw new Error('Informe a senha do portal.')
    await api('salvar_credencial_fiscal', { fonte, usuario_id_alvo: usuario.id, credencial: fonte === 'nota_parana' ? { cpf: l.replace(/\D/g, ''), senha } : { usuario: l, senha } })
    setSenha('')
    aoConectar()
    aoFechar()
  }, `${usuario.apelido} conectado ao ${f.nome}. Toque em “Testar” para conferir.`)
  return (
    <Folha aberta aoFechar={aoFechar} titulo={`Conectar ${usuario.apelido} ao ${f.nome}`}>
      <p style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--muted)' }}>{f.ajuda} A senha fica guardada só no Apps Script da família, nunca na planilha, e não volta para o app.</p>
      <Campo rotulo={f.usuario}>
        <input className="campo num" inputMode={fonte === 'nota_parana' ? 'numeric' : 'text'} autoComplete="off" value={login} onChange={(e) => setLogin(fonte === 'nota_parana' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)} placeholder={fonte === 'nota_parana' ? 'só números' : 'cpf ou e-mail'} autoFocus />
      </Campo>
      <Campo rotulo="Senha do portal">
        <div className="flex" style={{ gap: 6 }}>
          <input className="campo" type={mostrar ? 'text' : 'password'} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="button" className="btn btn-ghost" onClick={() => setMostrar((m) => !m)} aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}><Icone nome={mostrar ? 'eye-off' : 'eye'} /></button>
        </div>
      </Campo>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Conectar</button>
      </div>
    </Folha>
  )
}

function LinhaConexao({ c, usuario, ehAdmin, aoConectar, aoAtualizar }: { c: ConexaoNotas; usuario: Usuario; ehAdmin: boolean; aoConectar: () => void; aoAtualizar: () => void }) {
  const avisar = useSessao((e) => e.avisar)
  const { rodar, ocupado } = useAcao()
  const [teste, setTeste] = useState<ResultadoTesteNotas | null>(null)
  const testar = () => rodar(async () => {
    const r = await api<ResultadoTesteNotas>('testar_credencial_fiscal', { fonte: c.fonte, usuario_id_alvo: c.usuario_id })
    setTeste(r)
    if (r.ok) avisar(r.texto || 'Login ok.', { tipo: 'ok' })
    else avisar(`Não entrou: ${motivoTexto(r.motivo)}.`, { tipo: 'erro', duracao: 7000 })
    aoAtualizar()
  })
  const desconectar = () => rodar(async () => { await api('remover_credencial_fiscal', { fonte: c.fonte, usuario_id_alvo: c.usuario_id }); setTeste(null); aoAtualizar() }, 'Conexão removida.')
  const situacao = !c.conectado ? 'não conectado' : c.suspenso ? `suspenso: ${motivoTexto(c.motivo)}` : c.ultimo_ok ? `ok · última leitura ${quando(c.ultima_leitura || c.ultimo_ok)}` : 'conectado, ainda não testado'
  return (
    <div className="row" style={{ minHeight: 56, flexWrap: 'wrap' }}>
      <Avatar usuario={usuario} tamanho={28} />
      <span className="t">
        <b>{usuario.apelido} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {c.nome_fonte}</span></b>
        <small>{situacao}{c.total_notas ? ` · ${c.total_notas} nota${c.total_notas === 1 ? '' : 's'} lida${c.total_notas === 1 ? '' : 's'}` : ''}{c.restantes ? ` · ${c.restantes} por ler` : ''}</small>
        {teste && !teste.ok && teste.dica && <small style={{ color: 'var(--muted)' }}>{teste.dica}</small>}
      </span>
      {c.conectado ? <span className={`tag ${c.suspenso ? 'warn' : c.ultimo_ok ? 'ok' : 'proj'}`}>{c.suspenso ? 'suspenso' : c.ultimo_ok ? 'ativo' : 'conectado'}</span> : <span className="tag proj">desconectado</span>}
      {ehAdmin && (
        <span className="flex gap-1 flex-wrap">
          {c.conectado && <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={testar}><Icone nome="plug-zap" />Testar</button>}
          <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={aoConectar}><Icone nome={c.conectado ? 'key-round' : 'plus'} />{c.conectado ? 'Trocar senha' : 'Conectar'}</button>
          {c.conectado && <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={desconectar} aria-label="Desconectar"><Icone nome="x" /></button>}
        </span>
      )}
    </div>
  )
}

export function NotasFiscais() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const avisar = useSessao((e) => e.avisar)
  const { rodar, ocupado } = useAcao()
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const [status, setStatus] = useState<StatusNotasFiscais | null>(null)
  const [conectando, setConectando] = useState<{ fonte: FonteNota; usuario: Usuario } | null>(null)
  const [limites, setLimites] = useState({ direto: boot.config.notas_limite_direto ?? 500, grande: boot.config.notas_limite_grande ?? 1500 })
  const [resultado, setResultado] = useState<ResultadoSincronizacao[] | null>(null)
  const adultos = boot.usuarios.filter((u) => u.ativo && u.perfil !== 'Dependente')

  const carregar = () => api<StatusNotasFiscais>('status_notas_fiscais').then(setStatus).catch((e) => { setStatus({ conexoes: [], contagens: { total: 0, mes: 0, valor_mes: 0, a_confirmar: 0, empresa: 0 }, limites: { direto: 500, grande: 1500 }, rotina_ativa: true }); avisar(e instanceof Error ? e.message : 'Não foi possível carregar', { tipo: 'erro' }) })
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const salvarConfig = (c: Partial<Config>) => rodar(async () => atualizarConfig(await api<Config>('salvar_config', { config: c })))
  const sincronizar = () => rodar(async () => {
    const r = await api<ResultadoSincronizacao[]>('sincronizar_notas', { todos: ehAdmin })
    setResultado(r)
    await carregar()
  }, 'Robô executado.')

  const conexaoDe = (fonte: FonteNota, u: Usuario): ConexaoNotas =>
    status?.conexoes.find((c) => c.fonte === fonte && c.usuario_id === u.id) ?? { fonte, nome_fonte: FONTES.find((f) => f.id === fonte)!.nome, usuario_id: u.id, conectado: false, conectado_em: '', ultima_leitura: '', ultimo_ok: '', notas_novas: 0, suspenso: false, motivo: '', falhas: 0, total_notas: 0, restantes: 0 }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="flex flex-col gap-3.5">
        {FONTES.map((f) => (
          <div className="card" key={f.id}>
            <h3>{f.nome} <span className="sub">{f.id === 'nota_parana' ? 'compras com CPF na nota' : 'serviços em Curitiba'}</span></h3>
            {status === null ? <Carregando texto="Consultando as conexões…" /> : (
              <div className="rows">
                {adultos.map((u) => <LinhaConexao key={u.id} c={conexaoDe(f.id, u)} usuario={u} ehAdmin={ehAdmin} aoConectar={() => setConectando({ fonte: f.id, usuario: u })} aoAtualizar={carregar} />)}
                {!adultos.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum adulto ativo.</p>}
              </div>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>{f.ajuda} Site: <a href={f.site} target="_blank" rel="noreferrer" style={{ color: 'var(--sel)' }}>{f.site.replace('https://', '')}</a></p>
          </div>
        ))}
        {!ehAdmin && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Só o administrador conecta ou troca a senha do portal.</p>}
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Robô <span className="sub">a cada 6 horas e às 21h</span></h3>
          <div className="rows">
            <div className="row" style={{ minHeight: 52 }}>
              <span className="ico-sm"><Icone nome="receipt" /></span>
              <div className="t"><b>Ler as notas automaticamente</b><small>Cada compra com CPF vira lançamento (loja conhecida) ou cai na Caixa de entrada.</small></div>
              <Interruptor ligado={boot.config.rotina_notas !== false} aoMudar={(v) => salvarConfig({ rotina_notas: v })} rotulo="Ler as notas automaticamente" desabilitado={ocupado || !ehAdmin} />
            </div>
          </div>
          {status && (
            <div className="flex flex-wrap" style={{ gap: '4px 14px', fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
              <span><b className="num">{status.contagens.mes}</b> notas neste mês · <b className="num">{moeda(status.contagens.valor_mes)}</b></span>
              {status.contagens.a_confirmar > 0 && <span className="tag warn">{status.contagens.a_confirmar} para confirmar</span>}
              {status.contagens.empresa > 0 && <span className="tag proj">{status.contagens.empresa} da empresa</span>}
              <span><b className="num">{status.contagens.total}</b> no total</span>
            </div>
          )}
          <button className="btn btn-primary mt-3" disabled={ocupado || !status} onClick={sincronizar}><Icone nome="refresh-cw" />Ler as notas agora</button>
          {resultado && (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)' }}>
              {resultado.length === 0 && <li>Nenhum membro conectado ainda.</li>}
              {resultado.map((r, k) => <li key={k}><b>{boot.usuarios.find((u) => u.id === r.usuario_id)?.apelido ?? '?'} · {FONTES.find((f) => f.id === r.fonte)?.nome}:</b> {r.ok ? r.resumo : `não entrou (${motivoTexto(r.motivo)})`}</li>)}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Regras de lançamento <span className="sub">quando o robô decide sozinho</span></h3>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Campo rotulo="Lançar direto até (R$)" ajuda="Loja já conhecida (3 acertos) e valor até este limite: lança sem perguntar.">
              <input className="campo num" type="number" inputMode="decimal" min={0} step="50" value={limites.direto} disabled={!ehAdmin} onChange={(e) => setLimites({ ...limites, direto: Number(e.target.value) })} onBlur={() => limites.direto !== (boot.config.notas_limite_direto ?? 500) && salvarConfig({ notas_limite_direto: limites.direto })} />
            </Campo>
            <Campo rotulo="Sempre perguntar acima de (R$)" ajuda="Acima disso pergunta “Família ou Empresa?” mesmo em loja conhecida.">
              <input className="campo num" type="number" inputMode="decimal" min={0} step="100" value={limites.grande} disabled={!ehAdmin} onChange={(e) => setLimites({ ...limites, grande: Number(e.target.value) })} onBlur={() => limites.grande !== (boot.config.notas_limite_grande ?? 1500) && salvarConfig({ notas_limite_grande: limites.grande })} />
            </Campo>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '4px 0 0' }}>Nota-e (NF-e, nota de empresa) acima do limite direto e meses fora do padrão sempre pedem confirmação. Ao responder Família, Empresa ou Ignorar na Caixa de entrada, o robô aprende para o CNPJ da loja.</p>
        </div>

        <div className="card">
          <h3>Como usar <span className="sub">na loja e no app</span></h3>
          <div className="rows">
            <div className="row"><span className="ico-sm num">1</span><div className="t"><b>Peça CPF na nota</b><small>É o CPF do membro conectado que liga a compra ao portal.</small></div></div>
            <div className="row"><span className="ico-sm num">2</span><div className="t"><b>Diga “comprei no Condor”</b><small>Em Lançar › Falar ou no Assistente. O robô busca a nota e lança com o valor real e os itens.</small></div></div>
            <div className="row"><span className="ico-sm num">3</span><div className="t"><b>Confira a Caixa de entrada</b><small>Notas de loja nova ou valor alto perguntam: Família, Empresa ou Ignorar.</small></div></div>
          </div>
        </div>
      </div>

      {conectando && <FolhaConectar fonte={conectando.fonte} usuario={conectando.usuario} aoFechar={() => setConectando(null)} aoConectar={carregar} />}
    </div>
  )
}
