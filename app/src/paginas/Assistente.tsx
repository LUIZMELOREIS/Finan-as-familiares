/**
 * /assistente — conversa com o assistente financeiro (histórico + mensagens
 * novas, mini-barras, chips de sugestão, microfone, anexo) e, para adultos,
 * os cards "Rotinas automáticas" e "Alertas personalizados".
 */
import { useEffect, useRef, useState } from 'react'
import { api, arquivoParaBase64, comprimirImagem, emModoDemo } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import type { LeituraExtraida, MensagemAssistente } from '../tipos'
import { agoraIso, gerarId, numero } from '../util/formato'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando } from '../componentes/Carregando'
import { Icone } from '../componentes/Icone'
import { Mensagem, Pensando } from '../componentes/assistente/Mensagem'
import { Rotinas } from '../componentes/assistente/Rotinas'
import { Alertas } from '../componentes/assistente/Alertas'
import { useVozReconhecimento } from '../hooks/useVozReconhecimento'

const FORMA_TEXTO: Record<string, string> = { pix: 'no Pix', 'débito': 'no débito', 'crédito': 'no crédito', dinheiro: 'em dinheiro', boleto: 'no boleto' }

export default function Assistente() {
  const { usuario } = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const ehDependente = usuario.perfil === 'Dependente'
  const [mensagens, setMensagens] = useState<MensagemAssistente[] | null>(null)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const voz = useVozReconhecimento()

  useEffect(() => {
    let vivo = true
    Promise.all([
      api<MensagemAssistente[]>('listar_conversa', { limite: 40 }).catch(() => [] as MensagemAssistente[]),
      api<string[]>('assistente_sugestoes').catch(() => [] as string[]),
    ]).then(([hist, sug]) => { if (vivo) { setMensagens(hist); setSugestoes(sug) } })
    return () => { vivo = false }
  }, [])

  useEffect(() => { if (voz.final) setTexto(voz.final) }, [voz.final])

  // Rolagem automática para a última mensagem.
  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensagens, pensando])

  async function enviar(mensagem = texto, extra: Record<string, unknown> = {}, rotuloMeu?: string) {
    const t = mensagem.trim()
    if ((!t && !extra.imagem_base64) || pensando) return
    const minha: MensagemAssistente = { id: gerarId('m'), papel: 'eu', texto: rotuloMeu ?? t, data: agoraIso() }
    const historico = (mensagens ?? []).slice(-10)
    setMensagens((m) => [...(m ?? []), minha])
    setTexto('')
    setPensando(true)
    try {
      const r = await api<MensagemAssistente>('assistente', { mensagem: t, historico, ...extra })
      setMensagens((m) => [...(m ?? []), r])
      if (r.lancamento) avisar('Lançado pelo assistente', { tipo: 'ok' })
    } catch (e) {
      setMensagens((m) => [...(m ?? []), { id: gerarId('m'), papel: 'assistente', texto: e instanceof Error ? e.message : 'Não consegui responder agora. Tente de novo.', data: agoraIso() }])
    } finally {
      setPensando(false)
    }
  }

  async function anexar(arquivo: File) {
    setPensando(true)
    try {
      const blob = await comprimirImagem(arquivo)
      const imagem_base64 = await arquivoParaBase64(blob)
      if (emModoDemo()) {
        // Sem servidor: lê o cupom localmente e descreve para o assistente lançar.
        const le = await api<LeituraExtraida>('ler_imagem', { imagem_base64, mime: 'image/jpeg', tipo: 'cupom' })
        setPensando(false)
        const frase = `gastei ${numero(le.valor ?? 0)} em ${le.estabelecimento ?? 'loja'} ${FORMA_TEXTO[le.forma_pgto ?? 'pix']}`
        await enviar(frase, {}, `Foto do cupom: ${le.estabelecimento ?? 'cupom'} — R$ ${numero(le.valor ?? 0)}`)
      } else {
        setPensando(false)
        await enviar(texto.trim() || 'Lance este cupom', { imagem_base64, mime: 'image/jpeg' }, texto.trim() ? `${texto.trim()} (foto anexada)` : 'Foto do cupom anexada')
      }
    } catch (e) {
      setPensando(false)
      avisar(e instanceof Error ? e.message : 'Não foi possível ler a foto', { tipo: 'erro' })
    }
  }

  return (
    <>
      <Cabecalho titulo="Assistente financeiro" subtitulo="Pergunte sobre os gastos da família ou lance uma despesa escrevendo." />
      <div className="assist" style={ehDependente ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="card chat">
          <div ref={listaRef} className="rolagem-escondida" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 'min(62vh, 620px)', scrollBehavior: 'smooth' }} aria-live="polite">
            {mensagens === null ? <Carregando texto="Abrindo a conversa…" /> : mensagens.length === 0 ? (
              <div className="msg bot">Olá, {usuario.apelido}. Pergunte sobre os gastos da família (“quanto gastamos com delivery este mês?”) ou lance uma despesa escrevendo (“gastei 45 na padaria no pix”).</div>
            ) : mensagens.map((m) => <Mensagem key={m.id} m={m} />)}
            {pensando && <Pensando />}
          </div>
          <div className="suggest">
            {sugestoes.map((s) => <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando}>{s}</button>)}
          </div>
          <div className="composer">
            <input
              value={voz.ouvindo ? voz.parcial || texto : texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
              placeholder="Pergunte ou lance: “gastei 120 no posto”"
              aria-label="Mensagem"
              autoComplete="off"
            />
            <button type="button" className="icon-btn" aria-label={voz.ouvindo ? 'Parar de ouvir' : 'Falar'} title={voz.suportado ? 'Falar' : 'Este navegador não ouve pelo app; use o microfone do teclado'} onClick={voz.ouvindo ? voz.parar : voz.comecar} disabled={!voz.suportado} aria-pressed={voz.ouvindo} style={voz.ouvindo ? { color: 'var(--red)' } : undefined}><Icone nome="mic" /></button>
            <button type="button" className="icon-btn" aria-label="Anexar foto do cupom" onClick={() => arquivoRef.current?.click()} disabled={pensando}><Icone nome="camera" /></button>
            <input ref={arquivoRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-hidden="true" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) anexar(f); e.target.value = '' }} />
            <button type="button" className="icon-btn go" aria-label="Enviar" onClick={() => enviar()} disabled={pensando || !texto.trim()}><Icone nome="send" /></button>
          </div>
        </div>
        {!ehDependente && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Rotinas />
            <Alertas />
          </div>
        )}
      </div>
    </>
  )
}
