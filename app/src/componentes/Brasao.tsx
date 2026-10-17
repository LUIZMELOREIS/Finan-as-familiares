/** Brasão padrão (traço dourado sobre azul-noite) usado no círculo da barra lateral e na capa. */
export function BrasaoPadrao({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={tamanho} height={tamanho} fill="none" stroke="#F2C552" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 4 33 9v10c0 8.5-5.6 14.4-13 17-7.4-2.6-13-8.5-13-17V9z" />
      <path d="M20 12v16M14 18h12" />
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
