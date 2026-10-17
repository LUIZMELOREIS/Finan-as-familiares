import { useEffect, type ReactNode } from 'react'
import { Icone } from './Icone'

/** Folha (modal): sobe de baixo no celular, centralizada no computador. */
export function Folha({ aberta, aoFechar, titulo, children, largura }: { aberta: boolean; aoFechar: () => void; titulo?: string; children: ReactNode; largura?: number }) {
  useEffect(() => {
    if (!aberta) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = '' }
  }, [aberta, aoFechar])
  if (!aberta) return null
  return (
    <div className="folha-fundo" onClick={aoFechar} role="presentation">
      <div className="folha" style={largura ? { maxWidth: largura } : undefined} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="folha-alca" />
        {titulo && (
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{titulo}</h3>
            <button className="icon-btn" onClick={aoFechar} aria-label="Fechar"><Icone nome="x" /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
