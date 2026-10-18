import type { Usuario } from '../tipos'
import { corVar } from './Icone'

/** Avatar sóbrio: foto quando houver, senão iniciais sobre a cor do membro. Sem emojis. */
export function Avatar({ usuario, tamanho = 32 }: { usuario?: Pick<Usuario, 'nome' | 'apelido' | 'avatar' | 'cor'> | null; tamanho?: number }) {
  if (!usuario) return <span className="avatar" style={{ width: tamanho, height: tamanho, background: 'var(--slate)' }} aria-hidden="true" />
  const ehFoto = /^(https?:|data:|blob:)/.test(usuario.avatar || '')
  const iniciais = (usuario.apelido || usuario.nome || '?')
    .split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
  return (
    <span className="avatar" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.4), background: corVar(usuario.cor) }} title={usuario.apelido} aria-label={usuario.apelido}>
      {ehFoto ? <img src={usuario.avatar} alt="" /> : iniciais}
    </span>
  )
}
