import { useEffect, type ReactNode } from 'react'

/** Folha inferior (bottom sheet) — o "modal" do celular. */
export function Folha({ aberta, aoFechar, titulo, children }: { aberta: boolean; aoFechar: () => void; titulo?: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [aberta, aoFechar])
  if (!aberta) return null
  return (
    <div className="folha-fundo" onClick={aoFechar} role="presentation">
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="folha-alca" />
        {titulo && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button className="botao botao-fantasma" onClick={aoFechar} aria-label="Fechar">✕ <span className="text-sm">Fechar</span></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
