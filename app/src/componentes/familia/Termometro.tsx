import { useEffect, useState } from 'react'

/**
 * Termômetro que enche (SVG próprio). `pct` de 0 a 100.
 * A animação é um scaleY com origem embaixo — funciona em iPhone e Android.
 */
export function Termometro({ pct, altura = 250, mostrarMarcos = true }: { pct: number; altura?: number; mostrarMarcos?: boolean }) {
  const alvo = Math.max(0, Math.min(100, pct)) / 100
  const [escala, setEscala] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEscala(alvo))
    return () => cancelAnimationFrame(id)
  }, [alvo])

  // Geometria (viewBox 140 × 270)
  const tuboX = 44, tuboY = 16, tuboL = 36, tuboA = 190
  const bulboCX = 62, bulboCY = 228, bulboR = 30
  const cheio = alvo >= 1

  return (
    <svg viewBox="0 0 140 270" width={altura * (140 / 270)} height={altura} role="img" aria-label={`${Math.round(pct)}% da meta alcançado`}>
      <defs>
        <linearGradient id="term-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={cheio ? '#4CB963' : '#5B5BE0'} />
          <stop offset="100%" stopColor={cheio ? '#7ED48F' : '#BD55C7'} />
        </linearGradient>
        <clipPath id="term-clip">
          <rect x={tuboX} y={tuboY} width={tuboL} height={tuboA + 20} rx={tuboL / 2} />
          <circle cx={bulboCX} cy={bulboCY} r={bulboR} />
        </clipPath>
      </defs>

      {/* Trilha (vidro) */}
      <rect x={tuboX} y={tuboY} width={tuboL} height={tuboA + 20} rx={tuboL / 2} fill="color-mix(in srgb, var(--texto-suave) 18%, transparent)" />
      <circle cx={bulboCX} cy={bulboCY} r={bulboR} fill="color-mix(in srgb, var(--texto-suave) 18%, transparent)" />

      {/* Líquido */}
      <g clipPath="url(#term-clip)">
        <circle cx={bulboCX} cy={bulboCY} r={bulboR} fill="url(#term-grad)" opacity={alvo > 0 ? 1 : 0.35} />
        <rect
          x={tuboX}
          y={tuboY}
          width={tuboL}
          height={tuboA}
          fill="url(#term-grad)"
          style={{ transform: `scaleY(${escala})`, transformOrigin: `${tuboX + tuboL / 2}px ${tuboY + tuboA}px`, transition: 'transform 1.1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </g>

      {/* Contorno */}
      <rect x={tuboX} y={tuboY} width={tuboL} height={tuboA + 20} rx={tuboL / 2} fill="none" stroke="var(--borda)" strokeWidth="2" />
      <circle cx={bulboCX} cy={bulboCY} r={bulboR} fill="none" stroke="var(--borda)" strokeWidth="2" />

      {/* Marcos 25/50/75 */}
      {mostrarMarcos && [25, 50, 75, 100].map((m) => {
        const y = tuboY + tuboA - (tuboA * m) / 100
        return (
          <g key={m}>
            <line x1={tuboX + tuboL + 4} x2={tuboX + tuboL + 12} y1={y} y2={y} stroke="var(--texto-suave)" strokeWidth="2" />
            <text x={tuboX + tuboL + 16} y={y + 4} fontSize="12" fontWeight={600} fill="var(--texto-suave)" fontFamily="inherit">{m}%</text>
          </g>
        )
      })}

      {/* Percentual dentro do bulbo */}
      <text x={bulboCX} y={bulboCY + 6} textAnchor="middle" fontSize={pct >= 100 ? 15 : 17} fontWeight={800} fill="#fff" fontFamily="inherit" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,.35)', strokeWidth: 3 }}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}
