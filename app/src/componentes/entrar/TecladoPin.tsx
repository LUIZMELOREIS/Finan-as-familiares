/** PIN de 4 dígitos: `.pin-dots` + `.teclado` numérico (0–9 e apagar), sem emoji. */
import { useEffect } from 'react'
import { Icone } from '../Icone'

export function TecladoPin({ valor, aoMudar, desabilitado, rotulo }: { valor: string; aoMudar: (v: string) => void; desabilitado?: boolean; rotulo?: string }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (desabilitado) return
      if (/^\d$/.test(e.key) && valor.length < 4) aoMudar(valor + e.key)
      else if (e.key === 'Backspace') aoMudar(valor.slice(0, -1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [valor, aoMudar, desabilitado])

  const digitar = (d: string) => { if (!desabilitado && valor.length < 4) aoMudar(valor + d) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
      <div className="pin-dots" role="status" aria-label={`${rotulo ?? 'PIN'}: ${valor.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => <i key={i} className={i < valor.length ? 'cheio' : ''} />)}
      </div>
      <div className="teclado" aria-label="Teclado numérico">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" className="num" onClick={() => digitar(d)} disabled={desabilitado}>{d}</button>)}
        <span aria-hidden="true" />
        <button type="button" className="num" onClick={() => digitar('0')} disabled={desabilitado}>0</button>
        <button type="button" onClick={() => aoMudar(valor.slice(0, -1))} disabled={desabilitado || !valor} aria-label="Apagar último dígito"><Icone nome="chevron-left" tamanho={22} /></button>
      </div>
    </div>
  )
}
