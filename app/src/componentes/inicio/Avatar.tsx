import type { Usuario } from '../../tipos'

/** Avatar redondo do membro (emoji ou foto) com a cor dele. */
export function Avatar({ usuario, tamanho = 40, className = '' }: { usuario?: Pick<Usuario, 'avatar' | 'cor' | 'apelido'> | null; tamanho?: number; className?: string }) {
  const avatar = usuario?.avatar || '🙂'
  const ehUrl = /^https?:\/\//.test(avatar)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden ${className}`}
      style={{ width: tamanho, height: tamanho, background: usuario?.cor || 'var(--primaria)', fontSize: tamanho * 0.55, lineHeight: 1 }}
      role="img"
      aria-label={usuario?.apelido || 'Membro'}
    >
      {ehUrl ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span aria-hidden>{avatar}</span>}
    </span>
  )
}
