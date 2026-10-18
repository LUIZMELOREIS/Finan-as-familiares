/** Balões do Assistente (`.msg.me` / `.msg.bot`), negrito via **x**, mini-barras e etiqueta. */
import type { ReactNode } from 'react'
import type { MensagemAssistente } from '../../tipos'
import { moeda } from '../../util/formato'
import { corVar } from '../Icone'

/** Renderiza `**negrito**` como <b>. */
export function TextoRico({ texto }: { texto: string }): ReactNode {
  const partes = texto.split(/\*\*(.+?)\*\*/g)
  return partes.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))
}

/** Mini-barra comparativa (rótulo + barra proporcional na cor), igual à referência. */
export function MiniBarras({ barras }: { barras: NonNullable<MensagemAssistente['barras']> }) {
  const max = Math.max(...barras.map((b) => Math.abs(b.valor)), 1)
  return (
    <div className="mini" role="img" aria-label={barras.map((b) => `${b.rotulo}: ${moeda(b.valor)}`).join('; ')}>
      {barras.map((b, i) => (
        <div key={`${b.rotulo}_${i}`} className="hb">
          <span className="lbl">{b.rotulo}</span>
          <div className="track"><div className="fill" style={{ width: `${Math.max(2, Math.round((Math.abs(b.valor) / max) * 100))}%`, background: corVar(b.cor || 'indigo') }} title={moeda(b.valor)} /></div>
        </div>
      ))}
    </div>
  )
}

export function Mensagem({ m }: { m: MensagemAssistente }) {
  const minha = m.papel === 'eu'
  return (
    <div className={`msg ${minha ? 'me' : 'bot'}`}>
      <TextoRico texto={m.texto} />
      {!minha && m.etiqueta && <> <span className="tag ok">{m.etiqueta}</span></>}
      {!minha && m.barras && m.barras.length > 0 && <MiniBarras barras={m.barras} />}
    </div>
  )
}

/** Estado "pensando": três pontos sóbrios. */
export function Pensando() {
  return (
    <div className="msg bot" role="status" aria-label="O assistente está pensando">
      <span className="flex items-center" style={{ gap: 5, height: 20 }}>
        {[0, 1, 2].map((i) => <span key={i} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--muted)', animationDelay: `${i * 0.2}s` }} />)}
      </span>
    </div>
  )
}
