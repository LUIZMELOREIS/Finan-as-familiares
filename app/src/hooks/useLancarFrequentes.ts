/**
 * "Mais usados por você": guarda no aparelho quantas vezes cada categoria foi
 * confirmada por este usuário (chave `ff_categorias_frequentes_<usuario_id>`)
 * e devolve as 5 mais frequentes. Sem histórico, usa as do dia a dia.
 */
import { useCallback, useMemo, useState } from 'react'
import type { Categoria } from '../tipos'

type Contagem = Record<string, number>

const chave = (usuarioId: string) => `ff_categorias_frequentes_${usuarioId}`

/** Sem histórico: Supermercado, Combustível, Padaria, Farmácia, Delivery (igual à referência). */
export const PADRAO_FREQUENTES = ['c_mercado', 'c_combustivel', 'c_padaria', 'c_farmacia', 'c_delivery']

export function lerContagemFrequentes(usuarioId: string): Contagem {
  try {
    return JSON.parse(localStorage.getItem(chave(usuarioId)) || '{}') as Contagem
  } catch {
    return {}
  }
}

export function registrarCategoriaFrequente(usuarioId: string, categoriaId: string) {
  try {
    const c = lerContagemFrequentes(usuarioId)
    c[categoriaId] = (c[categoriaId] ?? 0) + 1
    localStorage.setItem(chave(usuarioId), JSON.stringify(c))
  } catch {
    /* sem armazenamento (modo privado) — segue sem lembrar */
  }
}

export function useLancarFrequentes(usuarioId: string, categorias: Categoria[], quantas = 5) {
  const [contagem, setContagem] = useState<Contagem>(() => lerContagemFrequentes(usuarioId))

  const registrar = useCallback((categoriaId: string) => {
    registrarCategoriaFrequente(usuarioId, categoriaId)
    setContagem(lerContagemFrequentes(usuarioId))
  }, [usuarioId])

  const frequentes = useMemo(() => {
    const visiveis = categorias.filter((c) => c.ativa !== false && !c.oculta_cardapio)
    const porId = new Map(visiveis.map((c) => [c.id, c]))
    const usadas = Object.entries(contagem)
      .filter(([id]) => porId.has(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => porId.get(id)!)
    const padrao = PADRAO_FREQUENTES.map((id) => porId.get(id)).filter((c): c is Categoria => !!c)
    const lista: Categoria[] = []
    for (const c of [...usadas, ...padrao]) {
      if (lista.length >= quantas) break
      if (!lista.includes(c)) lista.push(c)
    }
    return lista
  }, [categorias, contagem, quantas])

  return { frequentes, registrar }
}
