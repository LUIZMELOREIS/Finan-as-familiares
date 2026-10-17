/** Perfis lembrados neste aparelho (`localStorage ff_perfis_lembrados`). */
import type { Usuario } from '../../tipos'
import type { Sessao } from '../../api/cliente'

export interface PerfilLembrado {
  usuario_id: string
  apelido: string
  nome: string
  cor: string
  avatar: string
  url_api: string
  token_familia: string
  nome_familia: string
  url_foto_capa: string
}

const CHAVE = 'ff_perfis_lembrados'

export function lerPerfis(): PerfilLembrado[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]')
    return Array.isArray(v) ? (v as PerfilLembrado[]).filter((p) => p && p.usuario_id) : []
  } catch {
    return []
  }
}

export function salvarPerfis(perfis: PerfilLembrado[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(perfis)) } catch { /* modo privado */ }
}

/** Lembra (ou atualiza) um perfil neste aparelho, movendo-o para o início. */
export function lembrarPerfil(u: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'cor' | 'avatar'>, sessao: Sessao, familia: { nome_familia?: string; url_foto_capa?: string }) {
  const atual = lerPerfis().filter((p) => !(p.usuario_id === u.id && p.url_api === sessao.url_api))
  const anterior = lerPerfis().find((p) => p.usuario_id === u.id && p.url_api === sessao.url_api)
  const novo: PerfilLembrado = {
    usuario_id: u.id, apelido: u.apelido, nome: u.nome, cor: u.cor, avatar: /^https?:|^data:/.test(u.avatar || '') ? u.avatar : '',
    url_api: sessao.url_api, token_familia: sessao.token_familia,
    nome_familia: familia.nome_familia || anterior?.nome_familia || '',
    url_foto_capa: familia.url_foto_capa || anterior?.url_foto_capa || '',
  }
  salvarPerfis([novo, ...atual].slice(0, 8))
}

export function esquecerPerfis() { salvarPerfis([]) }

/** Perfis do modo demonstração (ver `api/mock.ts`). */
export const PERFIS_DEMO = [
  { usuario_id: 'u_luiz', nome: 'Luiz Reis', apelido: 'Luiz', cor: 'indigo', perfil: 'Administrador', token: 'tok_pai_demo' },
  { usuario_id: 'u_nina', nome: 'Nina Reis', apelido: 'Nina', cor: 'magenta', perfil: 'Administrador', token: 'tok_mae_demo' },
  { usuario_id: 'u_julia', nome: 'Júlia Reis', apelido: 'Júlia', cor: 'gold', perfil: 'Dependente', token: 'tok_ju_demo' },
  { usuario_id: 'u_pedro', nome: 'Pedro Reis', apelido: 'Pedro', cor: 'green', perfil: 'Dependente', token: 'tok_pedro_demo' },
] as const
