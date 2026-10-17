/**
 * Guarda no celular quantas vezes cada categoria foi usada por este usuário,
 * para a grade de "mais usadas" na tela de lançamento aparecer já na ordem certa.
 * Chave: ff_categorias_frequentes_<usuario_id>
 */
import { useCallback, useMemo, useState } from 'react'
import type { Categoria } from '../tipos'

type Contagem = Record<string, number>

function chave(usuarioId: string) {
  return `ff_categorias_frequentes_${usuarioId}`
}

export function lerContagem(usuarioId: string): Contagem {
  try {
    return JSON.parse(localStorage.getItem(chave(usuarioId)) || '{}') as Contagem
  } catch {
    return {}
  }
}

export function registrarUsoCategoria(usuarioId: string, categoriaId: string) {
  try {
    const c = lerContagem(usuarioId)
    c[categoriaId] = (c[categoriaId] ?? 0) + 1
    localStorage.setItem(chave(usuarioId), JSON.stringify(c))
  } catch {
    /* sem armazenamento — segue sem lembrar */
  }
}

/** Categorias padrão quando ainda não há histórico: as primeiras do Dia a Dia. */
const PADRAO_DESPESA = ['c_mercado', 'c_padaria', 'c_delivery', 'c_farmacia', 'c_combustivel', 'c_transporte', 'c_passeios', 'c_feira']
const PADRAO_RECEITA = ['c_salario', 'c_renda_extra', 'c_mesada_recebida', 'c_outras_receitas']

/**
 * Devolve as categorias mais usadas (até `quantas`), já ordenadas, do tipo pedido.
 * Sem histórico, usa as primeiras do Dia a Dia (ou as entradas mais comuns).
 */
export function useCategoriasFrequentes(usuarioId: string, categorias: Categoria[], tipo: 'despesa' | 'receita', quantas = 8) {
  const [contagem, setContagem] = useState<Contagem>(() => lerContagem(usuarioId))

  const registrar = useCallback((categoriaId: string) => {
    registrarUsoCategoria(usuarioId, categoriaId)
    setContagem(lerContagem(usuarioId))
  }, [usuarioId])

  const frequentes = useMemo(() => {
    const ativas = categorias.filter((c) => c.tipo === tipo && c.ativa !== false)
    const porId = new Map(ativas.map((c) => [c.id, c]))
    const usadas = Object.entries(contagem)
      .filter(([id]) => porId.has(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => porId.get(id)!)
    const padrao = (tipo === 'despesa' ? PADRAO_DESPESA : PADRAO_RECEITA).map((id) => porId.get(id)).filter((c): c is Categoria => !!c)
    const lista: Categoria[] = []
    for (const c of [...usadas, ...padrao, ...ativas]) {
      if (lista.length >= quantas) break
      if (!lista.includes(c)) lista.push(c)
    }
    return lista
  }, [categorias, contagem, tipo, quantas])

  return { frequentes, registrar }
}
