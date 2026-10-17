import { useSessao } from '../store/sessao'

/** Avisos ("toasts") com botão Desfazer de 5 segundos. */
export function Avisos() {
  const avisos = useSessao((e) => e.avisos)
  const fechar = useSessao((e) => e.fecharAviso)
  if (!avisos.length) return null
  return (
    <div className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }} aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso card flex items-center gap-3 px-4 py-3 w-full max-w-md ${a.tipo === 'erro' ? 'border-vermelho' : a.tipo === 'ok' ? 'border-verde' : ''}`}>
          <span className="text-xl" aria-hidden>{a.tipo === 'erro' ? '⚠️' : a.tipo === 'ok' ? '✅' : 'ℹ️'}</span>
          <span className="flex-1 text-sm">{a.texto}</span>
          {a.desfazer && (
            <button className="botao botao-amarelo !min-h-10 !px-3 text-sm" onClick={async () => { await a.desfazer?.(); fechar(a.id) }}>↩ Desfazer</button>
          )}
          <button className="botao botao-fantasma !min-h-10 !min-w-10 !p-1" onClick={() => fechar(a.id)} aria-label="Fechar aviso">✕</button>
        </div>
      ))}
    </div>
  )
}
