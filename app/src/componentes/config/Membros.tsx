import { useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Perfil, Usuario } from '../../tipos'
import { Folha } from '../Folha'
import { Campo, Interruptor, LinhaCopiar, SeletorCor, copiarTexto } from './comuns'
import { lerValor, numero } from '../../util/formato'

const AVATARES = ['👨', '👩', '👴', '👵', '👦', '👧', '🧑', '👶', '🧔', '👱‍♀️', '👩‍🦱', '👨‍🦳', '🧕', '👩‍🦰', '🙂', '😎', '🤓', '🥰', '🐶', '🐱', '🦁', '🐻', '🦊', '🐼']
const PERFIS: Perfil[] = ['Administrador', 'Adulto', 'Júnior']
const DESCRICAO_PERFIL: Record<Perfil, string> = {
  Administrador: 'faz tudo: configura, convida, vê salários',
  Adulto: 'lança, vê o painel e as contas; não mexe nas configurações',
  Júnior: 'lança os próprios gastos, vê a mesada e os sonhos',
}

/**
 * O QR Code do convite é gerado como imagem pela API pública api.qrserver.com
 * (sem biblioteca extra no app). Se não houver internet a imagem não carrega,
 * mas o link e o botão Copiar continuam funcionando.
 */
function urlQr(dados: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(dados)}`
}

export function Membros() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarUsuarios = useSessao((e) => e.atualizarUsuarios)
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [mesadaTxt, setMesadaTxt] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [convite, setConvite] = useState<{ perfil: Perfil; url?: string; codigo?: string; expira?: string } | null>(null)
  const [gerando, setGerando] = useState(false)
  const [qrOk, setQrOk] = useState(true)

  function abrir(u: Usuario) {
    setEditando({ ...u })
    setMesadaTxt(u.mesada_mensal ? numero(u.mesada_mensal) : '')
    setNovoPin('')
  }

  async function salvar() {
    if (!editando) return
    if (!editando.apelido.trim()) { avisar('Dê um apelido ao membro.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const usuario: Usuario = { ...editando, mesada_mensal: editando.perfil === 'Júnior' ? lerValor(mesadaTxt) : undefined }
      const salvo = await api<Usuario>('salvar_usuario', { usuario })
      const lista = boot.usuarios.some((u) => u.id === salvo.id) ? boot.usuarios.map((u) => (u.id === salvo.id ? { ...u, ...salvo, token: salvo.token ?? u.token } : u)) : [...boot.usuarios, salvo]
      atualizarUsuarios(lista)
      avisar('Membro salvo ✅', { tipo: 'ok' })
      setEditando(null)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  async function redefinirPin() {
    if (!editando) return
    if (!/^\d{4}$/.test(novoPin)) { avisar('O PIN precisa ter 4 números.', { tipo: 'erro' }); return }
    try {
      await api('redefinir_pin', { usuario_id: editando.id, pin: novoPin })
      avisar(`PIN de ${editando.apelido} redefinido ✅`, { tipo: 'ok' })
      setNovoPin('')
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao redefinir PIN', { tipo: 'erro' }) }
  }

  async function novoToken() {
    if (!editando) return
    if (!confirm(`Gerar um novo token para ${editando.apelido}? O atalho do celular dele(a) vai precisar ser atualizado com o novo token.`)) return
    try {
      const r = await api<{ token: string }>('renovar_token', { usuario_id: editando.id })
      atualizarUsuarios(boot.usuarios.map((u) => (u.id === editando.id ? { ...u, token: r.token } : u)))
      setEditando({ ...editando, token: r.token })
      avisar('Novo token gerado. O antigo não funciona mais. ✅', { tipo: 'ok' })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao gerar token', { tipo: 'erro' }) }
  }

  async function gerarConvite(perfil: Perfil) {
    setGerando(true)
    try {
      const r = await api<{ codigo_convite: string; url: string; expira_em: string }>('gerar_convite', { perfil })
      setQrOk(true)
      setConvite({ perfil, url: r.url, codigo: r.codigo_convite, expira: r.expira_em })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao gerar convite', { tipo: 'erro' }) }
    finally { setGerando(false) }
  }

  async function compartilhar() {
    if (!convite?.url) return
    const texto = `Convite para o app Finanças da Família (${boot.config.nome_familia}). Abra o link e escolha seu avatar e PIN: ${convite.url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Convite — Finanças da Família', text: texto, url: convite.url }) } catch { /* cancelou */ }
    } else {
      avisar((await copiarTexto(texto)) ? 'Convite copiado — cole no WhatsApp ✅' : 'Não foi possível copiar', { tipo: 'ok' })
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {boot.usuarios.map((u) => (
          <li key={u.id}>
            <button className={`w-full card card-toque p-3 flex items-center gap-3 text-left ${u.ativo === false ? 'opacity-50' : ''}`} onClick={() => ehAdmin && abrir(u)} disabled={!ehAdmin}>
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 border-2" style={{ background: `color-mix(in srgb, ${u.cor} 30%, transparent)`, borderColor: u.cor }} aria-hidden>{u.avatar}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{u.apelido} {u.id === boot.usuario.id && <span className="text-xs text-suave font-normal">(você)</span>}</span>
                <span className="block text-sm text-suave truncate">{u.nome} · {u.perfil}{u.perfil === 'Júnior' && u.mesada_mensal ? ` · mesada R$ ${numero(u.mesada_mensal)}` : ''}{u.ativo === false ? ' · inativo' : ''}</span>
              </span>
              {ehAdmin && <span className="text-suave text-2xl" aria-hidden>›</span>}
            </button>
          </li>
        ))}
      </ul>

      {ehAdmin && (
        <section className="card p-4 space-y-2">
          <h2 className="titulo-secao">Convidar alguém</h2>
          <p className="text-sm text-suave">Gere um link (vale 7 dias). A pessoa abre, escolhe avatar e PIN, e já entra.</p>
          <div className="grid grid-cols-1 gap-2">
            {PERFIS.map((p) => <button key={p} className="botao botao-secundario justify-start" disabled={gerando} onClick={() => gerarConvite(p)}>➕ Convidar como {p}</button>)}
          </div>
        </section>
      )}

      {/* Folha: editar membro */}
      <Folha aberta={!!editando} aoFechar={() => setEditando(null)} titulo={editando ? `Editar ${editando.apelido}` : ''}>
        {editando && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Apelido"><input className="campo" value={editando.apelido} onChange={(e) => setEditando({ ...editando, apelido: e.target.value })} /></Campo>
              <Campo rotulo="Nome"><input className="campo" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></Campo>
            </div>
            <div>
              <span className="rotulo">Avatar</span>
              <div className="grid grid-cols-8 gap-1">
                {AVATARES.map((a) => <button key={a} type="button" className={`h-12 rounded-lg text-2xl ${editando.avatar === a ? 'bg-primaria' : 'hover:bg-card-hover'}`} onClick={() => setEditando({ ...editando, avatar: a })} aria-label={`Avatar ${a}`}>{a}</button>)}
              </div>
            </div>
            <SeletorCor valor={editando.cor} aoMudar={(cor) => setEditando({ ...editando, cor })} />
            <div>
              <span className="rotulo">Perfil</span>
              <div className="space-y-1">
                {PERFIS.map((p) => (
                  <button key={p} type="button" className={`botao w-full justify-start !py-2 ${editando.perfil === p ? 'botao-primario' : 'botao-secundario'}`} onClick={() => setEditando({ ...editando, perfil: p })} aria-pressed={editando.perfil === p}>
                    <span className="text-left"><span className="block">{p}</span><span className="block text-xs font-normal opacity-80">{DESCRICAO_PERFIL[p]}</span></span>
                  </button>
                ))}
              </div>
            </div>
            {editando.perfil === 'Júnior' && (
              <Campo rotulo="Mesada mensal (R$)"><input className="campo" inputMode="decimal" value={mesadaTxt} onChange={(e) => setMesadaTxt(e.target.value)} placeholder="150,00" /></Campo>
            )}
            <Interruptor ligado={editando.ativo !== false} aoMudar={(v) => setEditando({ ...editando, ativo: v })} rotulo="Membro ativo" descricao="Inativo não consegue entrar, mas o histórico fica." />
            <button className="botao botao-primario w-full" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar membro'}</button>

            <div className="card p-3 space-y-2">
              <div className="font-semibold">🔑 Redefinir PIN</div>
              <div className="flex gap-2">
                <input className="campo flex-1 text-center tracking-[0.5em] text-xl" inputMode="numeric" maxLength={4} value={novoPin} onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" aria-label="Novo PIN de 4 números" />
                <button className="botao botao-secundario" onClick={redefinirPin} disabled={novoPin.length !== 4}>Redefinir</button>
              </div>
            </div>

            <div className="space-y-2">
              <LinhaCopiar rotulo="Token do membro (para o atalho do celular)" valor={editando.token ?? ''} avisar={(t) => avisar(t, { tipo: 'ok' })} mascarar />
              <button className="botao botao-fantasma w-full text-sm" onClick={novoToken}>♻️ Gerar novo token (revoga o antigo)</button>
            </div>
          </div>
        )}
      </Folha>

      {/* Folha: convite */}
      <Folha aberta={!!convite} aoFechar={() => setConvite(null)} titulo={convite ? `Convite para ${convite.perfil}` : ''}>
        {convite?.url && (
          <div className="space-y-3 text-center">
            {qrOk ? (
              <>
                <img src={urlQr(convite.url)} alt="QR Code do convite" width={240} height={240} className="mx-auto rounded-xl bg-white p-2" onError={() => setQrOk(false)} />
                <p className="text-sm text-suave">Aponte a câmera do celular da pessoa para o código, ou mande o link.</p>
              </>
            ) : (
              <p className="text-sm text-suave">Sem internet o QR Code não aparece — mande o link abaixo.</p>
            )}
            <LinhaCopiar rotulo="Link do convite" valor={convite.url} avisar={(t) => avisar(t, { tipo: 'ok' })} />
            <button className="botao botao-primario w-full !min-h-14" onClick={compartilhar}>📤 Compartilhar (WhatsApp, e-mail…)</button>
            <p className="text-xs text-suave">Código: <code>{convite.codigo}</code>{convite.expira ? ` · vale até ${new Date(convite.expira).toLocaleDateString('pt-BR')}` : ''}</p>
          </div>
        )}
      </Folha>
    </div>
  )
}
