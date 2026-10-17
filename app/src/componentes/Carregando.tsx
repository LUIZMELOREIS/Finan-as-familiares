import type { ReactNode } from 'react'
import { Icone } from './Icone'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ color: 'var(--muted)' }} role="status">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--sel)' }} />
      <span style={{ fontSize: 13 }}>{texto}</span>
    </div>
  )
}

export function Vazio({ icone = 'inbox', titulo, texto, children }: { icone?: string; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="card text-center" style={{ padding: 28 }}>
      <div className="ico mx-auto mb-3" style={{ width: 40, height: 40 }}><Icone nome={icone} tamanho={20} /></div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
      {texto && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 4 }}>{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
