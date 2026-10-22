/**
 * Convidar a família — o jeito rápido: uma linha por pessoa (nome, perfil e, se quiser, o
 * WhatsApp). Um toque gera o convite no servidor e abre o WhatsApp com a mensagem pronta
 * (link + 3 passos). Também dá para copiar a mensagem ou usar o Compartilhar do celular.
 * Só o Administrador entra aqui (regra do servidor para `gerar_convite`).
 */
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { Perfil } from '../tipos'
import { api, emModoDemo } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import { dataBr } from '../util/formato'
import { linkWhatsApp, mensagemConvite } from '../util/convidar'
import { Icone } from '../componentes/Icone'
import { BotaoCopiar, QrCode } from '../componentes/config/comuns'

interface ConviteGerado { codigo_convite: string; url: string; expira_em: string }
interface Pessoa { id: number; nome: string; perfil: Perfil; telefone: string; convite: ConviteGerado | null; gerando: boolean; enviado: boolean }

const PERFIS: Array<{ id: Perfil; nome: string; ajuda: string }> = [
  { id: 'Adulto', nome: 'Adulto', ajuda: 'lança, vê o painel e vota' },
  { id: 'Dependente', nome: 'Filho(a)', ajuda: 'lança os próprios gastos, vê a mesada e os projetos' },
  { id: 'Administrador', nome: 'Admin', ajuda: 'configura tudo, convida e aprova' },
]

let proximoId = 1
const novaPessoa = (perfil: Perfil = 'Adulto'): Pessoa => ({ id: proximoId++, nome: '', perfil, telefone: '', convite: null, gerando: false, enviado: false })

export default function Convidar() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [pessoas, setPessoas] = useState<Pessoa[]>(() => [novaPessoa('Adulto'), novaPessoa('Dependente')])
  const [qr, setQr] = useState<Pessoa | null>(null)
  const nomeFamilia = boot.config?.nome_familia || ''
  const podeShare = typeof navigator !== 'undefined' && 'share' in navigator

  if (boot.usuario.perfil !== 'Administrador') return <Navigate to="/configuracoes" replace />

  const mudar = (id: number, patch: Partial<Pessoa>) => setPessoas((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const textoDe = (p: Pessoa) => (p.convite ? mensagemConvite({ nome: p.nome, url: p.convite.url, nomeFamilia, validade: dataBr(p.convite.expira_em), quemConvida: boot.usuario.apelido }) : '')

  /** Gera o convite (uma vez por pessoa) e devolve a pessoa atualizada. */
  async function garantirConvite(p: Pessoa): Promise<Pessoa | null> {
    if (p.convite) return p
    mudar(p.id, { gerando: true })
    try {
      const convite = await api<ConviteGerado>('gerar_convite', { perfil: p.perfil })
      const nova = { ...p, convite, gerando: false }
      mudar(p.id, { convite, gerando: false })
      return nova
    } catch (e) {
      mudar(p.id, { gerando: false })
      avisar(e instanceof Error ? e.message : 'Não foi possível gerar o convite', { tipo: 'erro' })
      return null
    }
  }

  async function enviarWhatsApp(p: Pessoa) {
    const pronta = await garantirConvite(p)
    if (!pronta) return
    const url = linkWhatsApp(textoDe(pronta), pronta.telefone)
    // Sem 'noopener' de propósito: com ele o retorno é sempre null e não dá para saber se abriu.
    const janela = window.open(url, '_blank')
    if (!janela) location.href = url
    mudar(p.id, { enviado: true })
  }

  async function compartilhar(p: Pessoa) {
    const pronta = await garantirConvite(p)
    if (!pronta) return
    try { await navigator.share({ title: 'Convite — Finanças da Família', text: textoDe(pronta) }); mudar(p.id, { enviado: true }) } catch { /* cancelado */ }
  }

  async function copiar(p: Pessoa) {
    const pronta = await garantirConvite(p)
    if (!pronta) return
    try { await navigator.clipboard.writeText(textoDe(pronta)); avisar('Mensagem copiada. Cole no WhatsApp, SMS ou e-mail.', { tipo: 'ok' }); mudar(p.id, { enviado: true }) } catch { avisar('Não consegui copiar. Toque em WhatsApp ou Compartilhar.', { tipo: 'erro' }) }
  }

  async function mostrarQr(p: Pessoa) {
    const pronta = await garantirConvite(p)
    if (pronta) setQr(pronta)
  }

  const enviados = pessoas.filter((p) => p.enviado).length

  return (
    <>
      <div className="topbar">
        <div><h2>Convidar a família</h2><p>Um toque por pessoa: o convite é criado e a mensagem já vai pronta com o link e os 3 passos.</p></div>
        <div className="acoes"><Link className="btn btn-ghost" to="/configuracoes/membros"><Icone nome="users" />Membros</Link></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Como funciona <span className="sub">para quem recebe</span></h3>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--muted)', display: 'grid', gap: 4 }}>
          <li>Toca no link que recebeu (abre no navegador do celular).</li>
          <li>Escolhe apelido, foto e cria um PIN de 4 números.</li>
          <li>Toca em <b>Instalar</b> e o app fica entre os aplicativos do celular.</li>
        </ol>
        <p style={{ fontSize: 12, color: 'var(--faint)', margin: '10px 0 0' }}>Cada link serve para uma pessoa e vale 7 dias. Quem já tem perfil e trocou de celular não precisa de convite: use <Link to="/configuracoes/membros">Entrar em outro aparelho</Link>.</p>
      </div>

      <div className="card">
        <h3>Quem vai entrar <span className="sub">{enviados ? `${enviados} convite${enviados > 1 ? 's' : ''} enviado${enviados > 1 ? 's' : ''}` : 'nome, perfil e, se quiser, o WhatsApp'}</span></h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {pessoas.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: p.enviado ? 'color-mix(in srgb, var(--green) 8%, transparent)' : 'var(--card-2)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" style={{ gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`cv-nome-${p.id}`}>Nome</label>
                  <input id={`cv-nome-${p.id}`} value={p.nome} onChange={(e) => mudar(p.id, { nome: e.target.value })} placeholder="Ex.: Nina" autoComplete="off" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`cv-tel-${p.id}`}>WhatsApp <span className="sub">(opcional)</span></label>
                  <input id={`cv-tel-${p.id}`} className="num" inputMode="tel" value={p.telefone} onChange={(e) => mudar(p.id, { telefone: e.target.value })} placeholder="(41) 99999-0000" autoComplete="off" />
                </div>
              </div>
              <div className="field" style={{ margin: '10px 0 0' }}>
                <label id={`cv-perfil-${p.id}`}>Perfil · {PERFIS.find((x) => x.id === p.perfil)?.ajuda}</label>
                <div className="seg" role="group" aria-labelledby={`cv-perfil-${p.id}`} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {PERFIS.map((x) => <button key={x.id} type="button" aria-pressed={p.perfil === x.id} disabled={!!p.convite} onClick={() => mudar(p.id, { perfil: x.id })}>{x.nome}</button>)}
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap items-center">
                <button type="button" className="btn btn-primary" disabled={p.gerando} onClick={() => enviarWhatsApp(p)} style={{ background: '#1f9d55', borderColor: '#1f9d55' }}>
                  <Icone nome="message-circle" />{p.gerando ? 'Gerando convite…' : p.enviado ? 'Enviar de novo' : 'Enviar pelo WhatsApp'}
                </button>
                {podeShare && <button type="button" className="btn btn-ghost" disabled={p.gerando} onClick={() => compartilhar(p)}><Icone nome="share-2" />Compartilhar</button>}
                <button type="button" className="btn btn-ghost" disabled={p.gerando} onClick={() => copiar(p)}><Icone nome="copy" />Copiar mensagem</button>
                <button type="button" className="btn btn-ghost" disabled={p.gerando} onClick={() => mostrarQr(p)}><Icone nome="qr-code" />QR</button>
                {p.convite && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Código <b className="num">{p.convite.codigo_convite}</b> · vale até {dataBr(p.convite.expira_em)}</span>}
              </div>
              {p.convite && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>Ver a mensagem</summary>
                  <textarea readOnly rows={7} value={textoDe(p)} style={{ width: '100%', fontSize: 12, marginTop: 6 }} aria-label={`Mensagem para ${p.nome || 'convidado'}`} />
                  <div className="mt-2"><BotaoCopiar texto={p.convite.url} rotulo="Copiar só o link" /></div>
                </details>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={() => setPessoas((ps) => [...ps, novaPessoa()])}><Icone nome="user-plus" />Mais uma pessoa</button>
        </div>
        {emModoDemo() && <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>No modo demonstração os convites são de exemplo.</p>}
      </div>

      {qr && (
        <div role="dialog" aria-modal="true" aria-label="QR do convite" onClick={() => setQr(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 340 }}>
            <h3>{qr.nome ? `Convite para ${qr.nome}` : 'Convite'} <span className="sub">aponte a câmera</span></h3>
            {qr.convite && <QrCode texto={qr.convite.url} tamanho={240} />}
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '10px 0 0' }}>A pessoa aponta a câmera do celular, abre o link, escolhe o apelido e o PIN e toca em Instalar.</p>
            <button type="button" className="btn btn-ghost mt-3" onClick={() => setQr(null)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
