/**
 * Fila offline: lançamentos feitos sem internet ficam no IndexedDB e sobem
 * quando a conexão volta (evento `online` ou ao abrir o app).
 */
import { get, set } from 'idb-keyval'

const CHAVE = 'ff_fila_offline'

export interface ItemFila {
  id: string
  criado_em: string
  corpo: Record<string, unknown>
}

export async function listarFila(): Promise<ItemFila[]> {
  return (await get<ItemFila[]>(CHAVE)) ?? []
}

export async function enfileirar(corpo: Record<string, unknown>) {
  const fila = await listarFila()
  fila.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, criado_em: new Date().toISOString(), corpo })
  await set(CHAVE, fila)
  notificar(fila.length)
}

export async function tamanhoFila(): Promise<number> {
  return (await listarFila()).length
}

type Ouvinte = (n: number) => void
const ouvintes = new Set<Ouvinte>()
export function aoMudarFila(fn: Ouvinte) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}
function notificar(n: number) {
  ouvintes.forEach((fn) => fn(n))
}

/** Tenta enviar tudo o que está na fila. Devolve quantos subiram. */
export async function sincronizarFila(urlApi: string): Promise<number> {
  if (!urlApi || !navigator.onLine) return 0
  const fila = await listarFila()
  if (!fila.length) return 0
  const restantes: ItemFila[] = []
  let enviados = 0
  for (const item of fila) {
    try {
      const r = await fetch(urlApi, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(item.corpo),
        redirect: 'follow',
      })
      const json = await r.json()
      if (json?.ok) enviados++
      else restantes.push(item) // erro de negócio: mantém para o usuário revisar
    } catch {
      restantes.push(item)
    }
  }
  await set(CHAVE, restantes)
  notificar(restantes.length)
  return enviados
}
