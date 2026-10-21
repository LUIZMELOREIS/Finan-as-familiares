import { ShoppingCart, Car, Clapperboard, HeartPulse, House, GraduationCap, Wallet } from 'lucide-react'
import type { Categoria } from '../data/mock'

const ICONES = {
  mercado: ShoppingCart, transporte: Car, lazer: Clapperboard, saude: HeartPulse,
  casa: House, educacao: GraduationCap, renda: Wallet,
} as const

/** Ícone de categoria (Lucide), com rótulo acessível. */
export function CategoryIcon({ categoria, tamanho = 20 }: { categoria: Categoria; tamanho?: number }) {
  const Icone = ICONES[categoria]
  return <Icone size={tamanho} aria-hidden="true" />
}
