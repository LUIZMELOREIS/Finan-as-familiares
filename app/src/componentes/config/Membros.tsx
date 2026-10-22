import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Perfil, Usuario } from '../../tipos'
import { codificarConvite } from '../../util/convite'
import { lerSessao } from '../../api/cliente'
import { api, arquivoParaBase64, comprimirImagem, emModoDemo } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { dataBr, moeda } from '../../util/formato'
import { Icone } from '../Icone'
import { Avatar } from '../Avatar'
import { Folha } from '../Folha'
import { BotaoCopiar, Campo, CampoCopiavel, Interruptor, PERFIS, QrCode, SeletorCor, useAcao } from './comuns'

const DESCRICAO_PERFIL: Record<Perfil, string> = {
  Administrador: 'configura tudo, convida e aprova',
  Adulto: 'lança, vê o painel e vota',
  Dependente: 'lança os próprios gastos, vê a mesada e os projetos',
}

function novoUsuario(): Usuario {
  return { id: '', nome: '', apelido: '', avatar: '', cor: 'indigo', perfil: 'Adulto', ativo: true, criado_em: '', ultimo_acesso: '', mesada_mensal: 0 }
}

function FolhaMembro({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const boot = useBoot()
  const atualizarUsuarios = useSessao((e) => e.atualizarUsuarios)
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<Usuario>({ ...usuario })
  const [pin, setPin] = useState('')
  const [mostrarToken, setMostrarToken] = useState(false)
  const refFoto = useRef<HTMLInputElement>(null)
  const souEu = usuario.id === boot.usuario.id

  const salvar = () => rodar(async () => {
    if (!f.nome.trim()) throw new Error('Informe o nome.')
    const salvo = await api<Usuario>('salvar_usuario', { usuario: { ...f, apelido: f.apelido.trim() || f.nome.trim().split(' ')[0] } })
    const lista = boot.usuarios.some((u) => u.id === salvo.id) ? boot.usuarios.map((u) => (u.id === salvo.id ? { ...u, ...salvo } : u)) : [...boot.usuarios, salvo]
    atualizarUsuarios(lista)
    aoFechar()
  }, 'Membro salvo.')

  const enviarFoto = (arquivo: File) => rodar(async () => {
    const blob = await comprimirImagem(arquivo, 400, 0.85)
    const imagem_base64 = await arquivoParaBase64(blob)
    const { url } = await api<{ url: string }>('enviar_arquivo', { imagem_base64, mime: 'image/jpeg', pasta: 'Identidade da Família', nome_arquivo: `foto-${f.apelido || 'membro'}.jpg` })
    setF((x) => ({ ...x, avatar: url }))
  })

  const redefinirPin = () => rodar(async () => {
    if (!/^\d{4}$/.test(pin)) throw new Error('O PIN tem 4 dígitos.')
    await api('redefinir_pin', { usuario_id: f.id, pin })
    setPin('')
  }, 'PIN redefinido.')

  const renovarToken = () => rodar(async () => {
    const { token } = await api<{ token: string }>('renovar_token', { usuario_id: f.id })
    setF((x) => ({ ...x, token }))
    atualizarUsuarios(boot.usuarios.map((u) => (u.id === f.id ? { ...u, token } : u)))
  }, 'Token renovado. O anterior parou de funcionar.')

  return (
    <Folha aberta aoFechar={aoFechar} titulo={usuario.id ? `Editar ${usuario.apelido || usuario.nome}` : 'Novo membro'}>
      <div className="flex items-center gap-3 mb-3">
        <Avatar usuario={f} tamanho={56} />
        <div className="flex gap-2 flex-wrap">
          <input ref={refFoto} type="file" accept="image/*" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; if (a) enviarFoto(a); e.target.value = '' }} />
          <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={ocupado} onClick={() => refFoto.current?.click()}><Icone nome="camera" />{f.avatar ? 'Trocar foto' : 'Foto (opcional)'}</button>
          {f.avatar && <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => setF({ ...f, avatar: '' })}><Icone nome="x" />Sem foto</button>}
        </div>
      </div>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Nome completo"><input className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus={!usuario.id} /></Campo>
        <Campo rotulo="Apelido (como aparece no app)"><input className="campo" value={f.apelido} onChange={(e) => setF({ ...f, apelido: e.target.value })} /></Campo>
      </div>
      <Campo rotulo="Cor"><SeletorCor valor={f.cor} aoMudar={(cor) => setF({ ...f, cor })} /></Campo>
      <Campo rotulo="Perfil" ajuda={DESCRICAO_PERFIL[f.perfil]}>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {PERFIS.map((p) => <button key={p} type="button" aria-pressed={f.perfil === p} disabled={souEu && p !== 'Administrador'} onClick={() => setF({ ...f, perfil: p })}>{p}</button>)}
        </div>
      </Campo>
      {f.perfil === 'Dependente' && (
        <Campo rotulo="Mesada mensal (R$)"><input className="campo num" type="number" inputMode="decimal" min={0} step="0.01" value={f.mesada_mensal ?? 0} onChange={(e) => setF({ ...f, mesada_mensal: Number(e.target.value) })} /></Campo>
      )}
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}>
          <div className="t"><b>Membro ativo</b><small>Inativos não entram no app nem aparecem nos filtros.</small></div>
          <Interruptor ligado={f.ativo} aoMudar={(ativo) => setF({ ...f, ativo })} rotulo="Membro ativo" desabilitado={souEu} />
        </div>
      </div>
      <div className="flex gap-2 justify-end mb-4">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
      </div>

      {usuario.id && (
        <>
          <hr className="divisor" />
          <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Segurança</h4>
          <Campo rotulo="Redefinir PIN (4 dígitos)">
            <div className="flex gap-2">
              <input className="campo num" inputMode="numeric" maxLength={4} pattern="\d{4}" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" style={{ maxWidth: 140, letterSpacing: 6 }} aria-label="Novo PIN" />
              <button className="btn btn-ghost" disabled={ocupado || pin.length !== 4} onClick={redefinirPin}><Icone nome="lock" />Redefinir PIN</button>
            </div>
          </Campo>
          <Campo rotulo="Token de captura (pessoal)" ajuda="Usado pelas automações de SMS. Renovar invalida o anterior na hora.">
            <div className="flex gap-2 items-center flex-wrap">
              <input className="campo" readOnly value={f.token ? (mostrarToken ? f.token : '•'.repeat(16)) : '(não disponível)'} style={{ flex: 1, minWidth: 160, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }} aria-label="Token" />
              <button type="button" className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => setMostrarToken((m) => !m)} aria-label={mostrarToken ? 'Esconder token' : 'Mostrar token'}><Icone nome={mostrarToken ? 'eye-off' : 'eye'} /></button>
              {f.token && <BotaoCopiar texto={f.token} />}
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={ocupado} onClick={renovarToken}><Icone nome="refresh-cw" />Renovar</button>
            </div>
          </Campo>
        </>
      )}
    </Folha>
  )
}

function Convite() {
  const { rodar, ocupado } = useAcao()
  const [perfil, setPerfil] = useState<Perfil>('Adulto')
  const [convite, setConvite] = useState<{ codigo_convite: string; url: string; expira_em: string } | null>(null)
  const gerar = () => rodar(async () => setConvite(await api('gerar_convite', { perfil })))
  const compartilhar = async () => {
    if (!convite) return
    try { await navigator.share({ title: 'Convite — Finanças da Família', text: 'Entre no app de finanças da nossa família:', url: convite.url }) } catch { /* cancelado */ }
  }
  return (
    <div className="card">
      <h3>Convidar alguém <span className="sub">vale 7 dias</span></h3>
      <Link to="/convidar" className="btn btn-primary btn-block" style={{ marginBottom: 12, background: '#1f9d55', borderColor: '#1f9d55' }}><Icone nome="message-circle" />Convidar a família pelo WhatsApp (mais rápido)</Link>
      <Campo rotulo="Ou gere um convite avulso — perfil de quem vai entrar" ajuda={DESCRICAO_PERFIL[perfil]}>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {PERFIS.map((p) => <button key={p} type="button" aria-pressed={perfil === p} onClick={() => setPerfil(p)}>{p}</button>)}
        </div>
      </Campo>
      <button className="btn btn-primary" disabled={ocupado} onClick={gerar}><Icone nome="qr-code" />{convite ? 'Gerar outro convite' : 'Gerar convite'}</button>
      {convite && (
        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
          <QrCode texto={convite.url} tamanho={200} />
          <div className="flex-1 min-w-0" style={{ width: '100%' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px' }}>A pessoa abre o link no celular, toca em <b>Adicionar à Tela de Início</b>, escolhe apelido, foto e um PIN de 4 dígitos. Código: <b className="num">{convite.codigo_convite}</b> · expira em {dataBr(convite.expira_em)}.</p>
            <input className="campo" readOnly value={convite.url} onFocus={(e) => e.target.select()} aria-label="Link do convite" style={{ fontSize: 12 }} />
            <div className="flex gap-2 mt-2 flex-wrap">
              <BotaoCopiar texto={convite.url} rotulo="Copiar link" pequeno={false} />
              {'share' in navigator && <button className="btn btn-ghost" onClick={compartilhar}><Icone nome="share-2" />Compartilhar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Membros() {
  const boot = useBoot()
  const [editando, setEditando] = useState<Usuario | null>(null)
  const ordenados = [...boot.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || PERFIS.indexOf(a.perfil) - PERFIS.indexOf(b.perfil) || a.nome.localeCompare(b.nome))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="card">
        <h3>Membros da família <span className="sub">{boot.usuarios.filter((u) => u.ativo).length} ativos</span></h3>
        <div className="rows">
          {ordenados.map((u) => (
            <button key={u.id} className="row" style={{ minHeight: 56 }} onClick={() => setEditando(u)}>
              <Avatar usuario={u} tamanho={36} />
              <span className="t"><b>{u.nome}{u.id === boot.usuario.id ? ' (você)' : ''}</b><small>{u.apelido}{u.perfil === 'Dependente' && u.mesada_mensal ? ` · mesada ${moeda(u.mesada_mensal)}` : ''}{!u.ativo ? ' · inativo' : ''}</small></span>
              <span className={`tag ${u.perfil === 'Administrador' ? 'warn' : u.perfil === 'Dependente' ? 'ok' : 'proj'}`}>{u.perfil}</span>
              <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button className="btn btn-ghost" onClick={() => setEditando(novoUsuario())}><Icone nome="plus" />Adicionar manualmente</button>
        </div>
        {emModoDemo() && <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>No modo demonstração os tokens e convites são de exemplo.</p>}
      </div>
      <div className="flex flex-col gap-3.5">
        <Convite />
      <OutroAparelho />
        <div className="card">
          <h3>Perfis <span className="sub">o que cada um pode fazer</span></h3>
          <div className="rows">
            {PERFIS.map((p) => (
              <div key={p} className="row"><span className="ico-sm"><Icone nome={p === 'Administrador' ? 'crown' : p === 'Adulto' ? 'user-round' : 'baby'} /></span><span className="t"><b>{p}</b><small>{DESCRICAO_PERFIL[p]}{p === 'Dependente' ? ' — por padrão não vê salários' : ''}</small></span></div>
            ))}
          </div>
          {boot.usuario.token && <div className="mt-3"><CampoCopiavel rotulo="Seu token de captura" valor={boot.usuario.token} segredo /></div>}
        </div>
      </div>
      {editando && <FolhaMembro usuario={editando} aoFechar={() => setEditando(null)} />}
    </div>
  )
}

/** Link para a própria pessoa (ou outro membro já cadastrado) entrar num aparelho novo com o PIN, sem convite. */
function OutroAparelho() {
  const sessao = lerSessao()
  if (!sessao?.url_api) return null
  const link = `${location.origin}${location.pathname}?c=${codificarConvite({ convite: '', api: sessao.url_api, familia: sessao.token_familia })}`
  const compartilhar = async () => {
    try { await navigator.share({ title: 'Finanças da Família — outro aparelho', text: 'Abra no celular novo, escolha o seu nome e digite o seu PIN:', url: link }) } catch { /* cancelado */ }
  }
  return (
    <div className="card">
      <h3>Entrar em outro aparelho <span className="sub">quem já tem perfil</span></h3>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px' }}>Para o seu segundo celular, um tablet ou quando trocar de aparelho: abra este link lá, escolha o seu nome e digite o seu PIN. Não cria perfil novo e não precisa de convite.</p>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <QrCode texto={link} tamanho={160} />
        <div className="flex-1 min-w-0" style={{ width: '100%' }}>
          <input className="campo" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link para outro aparelho" style={{ fontSize: 12 }} />
          <div className="flex gap-2 mt-2 flex-wrap">
            {'share' in navigator && <button className="btn btn-primary btn-sm" onClick={compartilhar}><Icone nome="share-2" />Compartilhar</button>}
            <BotaoCopiar texto={link} rotulo="Copiar link" />
          </div>
        </div>
      </div>
    </div>
  )
}
