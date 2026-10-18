/** Renderiza os blocos do mini-conversor (markdown.ts) sem HTML bruto. */
import type { ReactNode } from 'react'
import type { Bloco, Trecho } from './markdown'

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return <>{trechos.map((t, i) => (t.negrito ? <b key={i} style={{ fontWeight: 600, color: 'var(--text)' }}>{t.texto}</b> : t.italico ? <i key={i}>{t.texto}</i> : <span key={i}>{t.texto}</span>))}</>
}

export function Blocos({ blocos }: { blocos: Bloco[] }) {
  const saida: ReactNode[] = []
  let lista: Bloco[] = []
  const despejar = () => {
    if (!lista.length) return
    saida.push(
      <ul key={`ul${saida.length}`} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
        {lista.map((b, i) => <li key={i} className="num"><Trechos trechos={b.trechos} /></li>)}
      </ul>,
    )
    lista = []
  }
  for (const b of blocos) {
    if (b.tipo === 'item') { lista.push(b); continue }
    despejar()
    if (b.tipo === 'citacao') saida.push(<p key={`q${saida.length}`} className="verse" style={{ fontSize: 12.5 }}><Trechos trechos={b.trechos} /></p>)
    else saida.push(<p key={`p${saida.length}`} className="num" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}><Trechos trechos={b.trechos} /></p>)
  }
  despejar()
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{saida}</div>
}
