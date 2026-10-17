import { useSessao } from '../store/sessao'
import { Icone } from './Icone'

/** Avisos ("toasts") com botão Desfazer de 5 segundos. */
export function Avisos() {
  const avisos = useSessao((e) => e.avisos)
  const fechar = useSessao((e) => e.fecharAviso)
  if (!avisos.length) return null
  return (
    <div className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }} aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className="aviso-toast card flex items-center gap-3 w-full max-w-md" style={{ padding: '10px 14px', borderLeft: `3px solid ${a.tipo === 'erro' ? 'var(--red)' : a.tipo === 'ok' ? 'var(--green)' : 'var(--sel)'}` }}>
          <Icone nome={a.tipo === 'erro' ? 'circle-alert' : a.tipo === 'ok' ? 'circle-check' : 'info'} />
          <span className="flex-1" style={{ fontSize: 13 }}>{a.texto}</span>
          {a.desfazer && <button className="btn btn-ghost btn-sm" onClick={async () => { await a.desfazer?.(); fechar(a.id) }}><Icone nome="undo-2" />Desfazer</button>}
          <button className="icon-btn" onClick={() => fechar(a.id)} aria-label="Fechar aviso"><Icone nome="x" /></button>
        </div>
      ))}
    </div>
  )
}
