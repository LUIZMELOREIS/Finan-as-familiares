/**
 * Carrega o `resumo_mes` de uma competência (AAAA-MM) e permite recarregar.
 * Usado na tela inicial e na tela do grupo.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/cliente'
import type { ResumoMes } from '../tipos'

export function useResumoMes(competencia: string) {
  const [resumo, setResumo] = useState<ResumoMes | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    api<ResumoMes>('resumo_mes', { competencia })
      .then((r) => { if (ativo) { setResumo(r); setErro(null) } })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o mês') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [competencia, versao])

  return { resumo, carregando, erro, recarregar }
}
