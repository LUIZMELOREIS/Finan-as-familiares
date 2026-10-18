/**
 * Falar: botão "Toque e fale" (Web Speech API, pt-BR). Sem suporte, campo de
 * texto com a dica de usar o microfone do teclado para ditar.
 */
import { useEffect, useState } from 'react'
import { useVozReconhecimento } from '../../hooks/useVozReconhecimento'
import { Icone } from '../Icone'

export function CapturaVoz({ aoTexto }: { aoTexto: (texto: string) => void }) {
  const voz = useVozReconhecimento()
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (voz.final) { setTexto(voz.final); aoTexto(voz.final) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voz.final])

  const aplicar = () => { const t = texto.trim(); if (t) aoTexto(t) }

  return (
    <div className="field">
      {voz.suportado ? (
        <button type="button" className="btn btn-primary btn-block" style={voz.ouvindo ? { background: 'var(--red)' } : undefined} onClick={voz.ouvindo ? voz.parar : voz.comecar} aria-pressed={voz.ouvindo}>
          <Icone nome="mic" />{voz.ouvindo ? 'Ouvindo… toque para parar' : 'Toque e fale'}
        </button>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Icone nome="info" />Este navegador não ouve direto pelo app: use o microfone do teclado para ditar no campo abaixo.
        </p>
      )}
      {voz.erro && <p style={{ fontSize: 12.5, color: '#FF8B91', margin: 0 }}>{voz.erro}</p>}
      <label htmlFor="voz-texto">{voz.suportado ? 'O que entendemos (pode corrigir)' : 'Fale ou digite o gasto'}</label>
      <textarea
        id="voz-texto"
        rows={2}
        value={voz.ouvindo ? voz.parcial || texto : texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aplicar() } }}
        placeholder="“Gastei 45 na padaria no Pix”"
      />
      {texto.trim() && !voz.ouvindo && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }} onClick={aplicar}><Icone nome="check" />Entendi</button>
      )}
    </div>
  )
}
