import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Cabeçalho de página interna com botão Voltar grande. */
export function Cabecalho({ titulo, voltarPara, acao }: { titulo: string; voltarPara?: string; acao?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="area-segura-topo sticky top-0 z-30 bg-painel/90 backdrop-blur border-b border-borda">
      <div className="max-w-3xl mx-auto flex items-center gap-2 px-3 py-2">
        <button className="botao botao-fantasma !px-2" onClick={() => (voltarPara ? nav(voltarPara) : nav(-1))} aria-label="Voltar">
          <span className="text-xl" aria-hidden>‹</span> <span className="text-sm">Voltar</span>
        </button>
        <h1 className="flex-1 text-lg font-bold truncate">{titulo}</h1>
        {acao}
      </div>
    </header>
  )
}
