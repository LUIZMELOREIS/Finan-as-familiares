/**
 * Perfis lembrados neste celular (tela "Quem é você?" estilo Netflix).
 * Chave: ff_perfis_lembrados — lista de {usuario_id, apelido, avatar, cor, url_api, token_familia}.
 */
import { useCallback, useState } from 'react'

export interface PerfilLembrado {
  usuario_id: string
  apelido: string
  avatar: string
  cor: string
  url_api: string
  token_familia: string
}

const CHAVE = 'ff_perfis_lembrados'

export function lerPerfisLembrados(): PerfilLembrado[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]')
    return Array.isArray(lista) ? (lista as PerfilLembrado[]) : []
  } catch {
    return []
  }
}

export function salvarPerfilLembrado(p: PerfilLembrado) {
  try {
    const lista = lerPerfisLembrados().filter((x) => !(x.usuario_id === p.usuario_id && x.url_api === p.url_api))
    lista.unshift(p)
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, 8)))
  } catch {
    /* sem armazenamento */
  }
}

export function esquecerPerfil(usuarioId: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lerPerfisLembrados().filter((x) => x.usuario_id !== usuarioId)))
  } catch {
    /* sem armazenamento */
  }
}

export function usePerfisLembrados() {
  const [perfis, setPerfis] = useState<PerfilLembrado[]>(() => lerPerfisLembrados())
  const lembrar = useCallback((p: PerfilLembrado) => { salvarPerfilLembrado(p); setPerfis(lerPerfisLembrados()) }, [])
  const esquecer = useCallback((id: string) => { esquecerPerfil(id); setPerfis(lerPerfisLembrados()) }, [])
  return { perfis, lembrar, esquecer }
}
