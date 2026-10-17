import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icone } from './Icone'

/** Barra de título de uma tela (igual ao `.topbar` da referência), com botão Voltar opcional. */
export function Cabecalho({ titulo, subtitulo, voltarPara, acoes }: { titulo: string; subtitulo?: string; voltarPara?: string; acoes?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="topbar">
      <div className="flex items-center gap-2 min-w-0">
        {voltarPara !== undefined && (
          <button className="icon-btn" style={{ marginLeft: -8 }} onClick={() => (voltarPara ? nav(voltarPara) : nav(-1))} aria-label="Voltar"><Icone nome="chevron-left" /></button>
        )}
        <div className="min-w-0"><h2 className="truncate">{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
      </div>
      {acoes && <div className="acoes">{acoes}</div>}
    </div>
  )
}
