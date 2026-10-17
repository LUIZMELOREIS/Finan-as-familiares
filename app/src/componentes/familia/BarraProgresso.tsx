import { useEffect, useState } from 'react'

/** Barra grossa animada (enche ao aparecer). `pct` de 0 a 100. */
export function BarraProgresso({ pct, altura = 14, cor }: { pct: number; altura?: number; cor?: string }) {
  const alvo = Math.max(0, Math.min(100, pct))
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLargura(alvo))
    return () => cancelAnimationFrame(id)
  }, [alvo])
  const fundo = cor ?? (alvo >= 100 ? 'var(--verde)' : 'linear-gradient(90deg, var(--primaria), var(--magenta))')
  return (
    <div className="progresso" style={{ height: altura }} role="progressbar" aria-valuenow={Math.round(alvo)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${largura}%`, background: fundo, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} />
    </div>
  )
}
