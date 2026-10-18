/** Carrega os projetos pela API, completa os campos calculados e define a cor de cada um. */
import { api } from '../../api/cliente'
import { useSessao } from '../../store/sessao'
import { competenciaDe } from '../../util/formato'
import versiculosBase from '../../../../dados/versiculos.json'
import type { Versiculo } from '../../tipos'
import { CORES_PROJETO, completarProjeto, type ProjetoCalculado } from './calculos'

export type ProjetoPronto = ReturnType<typeof completarProjeto> & { cor: string }

/** Ordena por prioridade e atribui cor pela ordem quando o projeto não tem uma escolhida. */
export function prepararProjetos(lista: ProjetoCalculado[], compAtual = competenciaDe()): ProjetoPronto[] {
  const ordem = { ativo: 0, votação: 0, pausado: 1, concluído: 2 } as const
  return [...lista]
    .sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || a.prioridade - b.prioridade || a.criado_em.localeCompare(b.criado_em))
    .map((p, i) => ({ ...completarProjeto(p, compAtual), cor: p.cor || CORES_PROJETO[i % CORES_PROJETO.length] }))
}

/** `listar_projetos` + atualização do bootstrap (os cards do Painel usam a mesma lista). */
export async function carregarProjetos(): Promise<ProjetoPronto[]> {
  const lista = await api<ProjetoCalculado[]>('listar_projetos')
  useSessao.getState().atualizarProjetos(lista)
  return prepararProjetos(lista)
}

export const VERSICULOS: Versiculo[] = versiculosBase as Versiculo[]

/** Versículo pela referência ("Lucas 14:28" ou "Lc 14.28"); tolera ponto/dois-pontos. */
export function versiculoPorReferencia(ref: string | undefined): Versiculo | undefined {
  if (!ref) return undefined
  const norm = (s: string) => s.toLowerCase().replace(/[.:]/g, ':').replace(/\s+/g, ' ').trim()
  const alvo = norm(ref)
  return VERSICULOS.find((v) => norm(v.referencia) === alvo)
}

/** Versículos de planejamento e provisão, para o formulário do projeto. */
export const VERSICULOS_PROJETO = VERSICULOS.filter((v) => v.tema === 'planejamento' || v.tema === 'provisão')
