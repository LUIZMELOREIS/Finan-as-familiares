import { useEffect, useState } from 'react'
import { useReconhecimentoVoz } from '../../hooks/useReconhecimentoVoz'

const EXEMPLOS = ['“Gastei 45 reais na padaria no pix”', '“Mercado 320 e 50 no cartão”', '“Recebi 300 de renda extra”']

/**
 * Falar o gasto: botão grande "Toque e fale" (Web Speech API, pt-BR).
 * Sem suporte (iPhone/Safari): campo de texto grande com a dica de usar o microfone do teclado.
 */
export function CapturaVoz({ aoTexto, aoCancelar }: { aoTexto: (texto: string) => void; aoCancelar: () => void }) {
  const voz = useReconhecimentoVoz()
  const [texto, setTexto] = useState('')

  useEffect(() => { if (voz.final) setTexto(voz.final) }, [voz.final])

  const continuar = () => { const t = texto.trim(); if (t) aoTexto(t) }

  return (
    <div className="flex flex-col flex-1 gap-4">
      <div className="card p-4">
        <div className="titulo-secao mb-1">Diga assim</div>
        <ul className="text-sm text-suave space-y-0.5">{EXEMPLOS.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>

      {voz.suportado ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={voz.ouvindo ? voz.parar : voz.comecar}
            className={`w-40 h-40 rounded-full flex flex-col items-center justify-center gap-1 text-white font-bold shadow-lg transition ${voz.ouvindo ? 'bg-vermelho pulsar' : 'bg-primaria'}`}
            aria-pressed={voz.ouvindo}
            aria-label={voz.ouvindo ? 'Parar de ouvir' : 'Toque e fale'}
          >
            <span className="text-5xl" aria-hidden>🎤</span>
            <span>{voz.ouvindo ? 'Ouvindo…' : 'Toque e fale'}</span>
          </button>
          {voz.ouvindo && <div className="text-suave text-sm">Toque de novo quando terminar</div>}
          {voz.erro && <div className="text-sm text-vermelho text-center">{voz.erro}</div>}
        </div>
      ) : (
        <div className="card p-3 text-sm flex gap-2 items-start">
          <span className="text-xl" aria-hidden>💡</span>
          <span>Este navegador não ouve direto pelo app. <b>Use o microfone do teclado</b> para ditar no campo abaixo e toque em Entendi.</span>
        </div>
      )}

      <label className="block">
        <span className="rotulo">{voz.suportado ? 'O que entendemos (pode corrigir)' : 'Fale ou digite o gasto'}</span>
        <textarea
          className="campo min-h-28 text-lg"
          value={voz.ouvindo ? voz.parcial || texto : texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: gastei 45 reais na padaria no pix"
          rows={3}
        />
      </label>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button type="button" className="botao botao-secundario !min-h-14" onClick={aoCancelar}><span aria-hidden>←</span> Voltar</button>
        <button type="button" className="botao botao-primario !min-h-14" onClick={continuar} disabled={!texto.trim()}>
          <span aria-hidden>✅</span> Entendi
        </button>
      </div>
    </div>
  )
}
