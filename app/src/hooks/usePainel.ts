/**
 * Dados do Painel: resumo do mês (cards), painel do ano (gráficos), próximas saídas,
 * avisos e contador da Caixa de entrada. Reage aos filtros globais e recarrega ao
 * voltar à aba (evento de foco / visibilidade).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Aviso, DadosPainel, ItemCaixaEntrada, ResumoMes, SaidaPrevista } from '../tipos'
import { api } from '../api/cliente'
import { useSessao, competenciaDosFiltros } from '../store/sessao'
import { somarMeses } from '../util/formato'

export interface Mesada { mesada_mensal: number; gasto: number; saldo: number; cofrinho: number }

export interface DadosDoPainel {
  resumo: ResumoMes | null
  resumoAnterior: ResumoMes | null
  painel: DadosPainel | null
  saidas: SaidaPrevista[] | null
  avisos: Aviso[] | null
  mesada: Mesada | null
  pendentes: number
  atualizadoEm: Date | null
  carregando: boolean
  erro: string
  recarregar: () => void
}

export function usePainel(): DadosDoPainel {
  const filtros = useSessao((e) => e.filtros)
  const boot = useSessao((e) => e.boot)
  const setContasAPagar = useSessao((e) => e.setContasAPagar)
  const setPendentesCaixa = useSessao((e) => e.setPendentesCaixa)
  const ehDependente = boot?.usuario.perfil === 'Dependente'
  const meuId = boot?.usuario.id ?? ''

  const [estado, setEstado] = useState<Omit<DadosDoPainel, 'recarregar'>>({
    resumo: null, resumoAnterior: null, painel: null, saidas: null, avisos: null, mesada: null, pendentes: 0, atualizadoEm: null, carregando: true, erro: '',
  })
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const ultimaCarga = useRef(0)

  const competencia = competenciaDosFiltros(filtros)
  const membro = ehDependente ? meuId : filtros.membro

  useEffect(() => {
    let vivo = true
    setEstado((e) => ({ ...e, carregando: true, erro: '' }))
    const filtroUsuario = membro || undefined
    const anterior = somarMeses(competencia, -1)

    const pResumo = api<ResumoMes>('resumo_mes', { competencia, usuario_id_filtro: filtroUsuario })
    const pAnterior = api<ResumoMes>('resumo_mes', { competencia: anterior, usuario_id_filtro: filtroUsuario }).catch(() => null)
    const pPainel = ehDependente ? Promise.resolve(null) : api<DadosPainel>('painel', { ano: filtros.ano, usuario_id_filtro: filtroUsuario })
    const pSaidas = ehDependente ? Promise.resolve(null) : api<SaidaPrevista[]>('proximas_saidas', { dias: 30 }).catch(() => [] as SaidaPrevista[])
    const pAvisos = ehDependente ? Promise.resolve(null) : api<Aviso[]>('listar_avisos', { limite: 6 }).catch(() => [] as Aviso[])
    const pCaixa = api<ItemCaixaEntrada[]>('listar_caixa_entrada', { status: 'pendente' }).catch(() => [] as ItemCaixaEntrada[])
    const pMesada = ehDependente ? api<Mesada>('mesada', { competencia }).catch(() => null) : Promise.resolve(null)

    Promise.all([pResumo, pAnterior, pPainel, pSaidas, pAvisos, pCaixa, pMesada])
      .then(([resumo, resumoAnterior, painel, saidas, avisos, caixa, mesada]) => {
        if (!vivo) return
        const pendentes = caixa.length
        setPendentesCaixa(pendentes)
        if (saidas) setContasAPagar(saidas.filter((s) => s.status === 'prevista' || s.status === 'lida_do_email').length)
        ultimaCarga.current = Date.now()
        setEstado({ resumo, resumoAnterior, painel, saidas, avisos: avisos ? avisos.slice(0, 6) : null, mesada, pendentes, atualizadoEm: new Date(), carregando: false, erro: '' })
      })
      .catch((e) => {
        if (!vivo) return
        setEstado((est) => ({ ...est, carregando: false, erro: e instanceof Error ? e.message : 'Não foi possível carregar o painel' }))
      })
    return () => { vivo = false }
  }, [competencia, membro, filtros.ano, ehDependente, versao, setContasAPagar, setPendentesCaixa])

  // Recarrega ao voltar à aba (no máximo uma vez a cada 30 s).
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimaCarga.current > 30_000) recarregar()
    }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { window.removeEventListener('focus', aoVoltar); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [recarregar])

  return { ...estado, recarregar }
}
