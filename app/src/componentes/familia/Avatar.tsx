import type { Usuario } from '../../tipos'

/** Avatar redondo de um membro (emoji ou foto), com a cor dele no fundo. */
export function Avatar({ usuario, tamanho = 36, titulo }: { usuario?: Pick<Usuario, 'avatar' | 'cor' | 'apelido'>; tamanho?: number; titulo?: string }) {
  const ehUrl = !!usuario?.avatar && /^(https?:|data:)/.test(usuario.avatar)
  const rotulo = titulo ?? usuario?.apelido ?? 'Membro'
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden ring-2 ring-card"
      style={{ width: tamanho, height: tamanho, background: usuario?.cor || 'var(--borda)', fontSize: tamanho * 0.55, lineHeight: 1 }}
      title={rotulo}
      aria-label={rotulo}
      role="img"
    >
      {ehUrl ? <img src={usuario!.avatar} alt="" className="w-full h-full object-cover" /> : <span aria-hidden>{usuario?.avatar || '👤'}</span>}
    </span>
  )
}
