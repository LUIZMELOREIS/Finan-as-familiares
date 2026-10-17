import { useState } from 'react'
import type { TipoLancamento } from '../../tipos'
import { moeda } from '../../util/formato'
import { TecladoDigitos } from './TecladoDigitos'

/**
 * Passo 1 da digitação: valor em R$ estilo calculadora (digita 4590 → R$ 45,90),
 * alternância Despesa/Entrada e botão Continuar.
 */
export function TecladoValor({ valorInicial, tipo, aoMudarTipo, aoContinuar, podeEntrada = true }: {
  valorInicial: number
  tipo: TipoLancamento
  aoMudarTipo: (t: TipoLancamento) => void
  aoContinuar: (valor: number) => void
  podeEntrada?: boolean
}) {
  // Guardamos só os dígitos em centavos: "4590" = R$ 45,90.
  const [centavos, setCentavos] = useState(() => (valorInicial ? String(Math.round(valorInicial * 100)) : ''))
  const valor = Number(centavos || '0') / 100

  const digitar = (d: string) => setCentavos((c) => (c.length >= 10 ? c : (c + d).replace(/^0+(?=\d)/, '')))
  const apagar = () => setCentavos((c) => c.slice(0, -1))

  return (
    <div className="flex flex-col gap-4 flex-1">
      {podeEntrada && (
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-card border border-borda" role="radiogroup" aria-label="Tipo de lançamento">
          {(['despesa', 'receita'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => aoMudarTipo(t)}
              className={`botao !rounded-xl ${tipo === t ? (t === 'despesa' ? 'bg-vermelho text-white' : 'bg-verde text-white') : 'botao-fantasma'}`}>
              <span aria-hidden>{t === 'despesa' ? '🛒' : '💰'}</span> {t === 'despesa' ? 'Despesa' : 'Entrada'}
            </button>
          ))}
        </div>
      )}

      <div className="text-center py-3">
        <div className="text-sm text-suave">{tipo === 'despesa' ? 'Quanto gastou?' : 'Quanto entrou?'}</div>
        <div className={`font-extrabold tabular-nums tracking-tight ${centavos.length > 8 ? 'text-4xl' : 'text-5xl'} ${centavos ? '' : 'text-suave/60'}`} aria-live="polite" aria-atomic>
          {moeda(valor)}
        </div>
      </div>

      <TecladoDigitos aoDigito={digitar} aoApagar={apagar} aoApagarTudo={() => setCentavos('')} teclaExtra="," aoExtra={() => { /* a vírgula é automática: os dois últimos dígitos são os centavos */ }} />

      <button type="button" className="botao botao-primario !min-h-16 text-lg w-full" disabled={valor <= 0} onClick={() => aoContinuar(valor)}>
        Continuar <span aria-hidden>→</span>
      </button>
    </div>
  )
}
