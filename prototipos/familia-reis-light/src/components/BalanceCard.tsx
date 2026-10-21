import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatarMoeda } from '../utils/format'

/** ==== CARD DE SALDO CONSOLIDADO (gradiente azul + olho de privacidade) ==== */
export function BalanceCard({ saldo }: { saldo: number }) {
  const [visivel, setVisivel] = useState(true)
  return (
    <section className="card saldo" aria-label="Saldo geral da família">
      <p className="rotulo">Saldo Geral da Família</p>
      <p className="valor num" aria-live="polite">{visivel ? formatarMoeda(saldo) : 'R$ ••••••'}</p>
      <button type="button" className="olho" aria-pressed={!visivel} aria-label={visivel ? 'Ocultar saldo' : 'Mostrar saldo'} onClick={() => setVisivel((v) => !v)}>
        {visivel ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>
    </section>
  )
  /* ==== FIM DO CARD DE SALDO ==== */
}
