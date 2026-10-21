import { GRADIENTE_OURO, OPACIDADE_PETALA, PETALAS } from './brasao/rosacea.gerado'

/**
 * Brasão padrão: rosácea dourada de oito luas entrelaçadas (gerada por scripts/gerar-brasao.mjs),
 * usada no círculo da barra lateral, na capa e como base dos ícones do app.
 */
export function BrasaoPadrao({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={tamanho} height={tamanho} aria-hidden="true">
      <defs>
        <linearGradient id="brasao-ouro" x1="0" y1="0" x2="1" y2="1">
          {GRADIENTE_OURO.map(([offset, cor]) => <stop key={offset} offset={offset} stopColor={cor} />)}
        </linearGradient>
      </defs>
      <g fill="url(#brasao-ouro)" fillOpacity={OPACIDADE_PETALA}>
        {PETALAS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  )
}

/** Círculo com borda dourada: brasão próprio (URL/SVG), foto recortada ou o brasão padrão. */
export function Crest({ url, foto, className = '' }: { url?: string; foto?: string; className?: string }) {
  const img = url || foto
  return (
    <div className={`crest ${className}`} aria-hidden="true">
      {img ? <img src={img} alt="" /> : <BrasaoPadrao />}
    </div>
  )
}
