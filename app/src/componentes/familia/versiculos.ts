import versiculos from '../../../../dados/versiculos.json'
import type { TemaVersiculo, Versiculo } from '../../tipos'

const LISTA = versiculos as Versiculo[]

export function versiculoPorReferencia(referencia: string | undefined): Versiculo | undefined {
  if (!referencia) return undefined
  const ref = referencia.trim().toLowerCase()
  return LISTA.find((v) => v.referencia.toLowerCase() === ref)
}

export function versiculosPorTema(...temas: TemaVersiculo[]): Versiculo[] {
  return LISTA.filter((v) => temas.includes(v.tema))
}

export const LUCAS_14_28 = 'Lucas 14:28'
export const FILIPENSES_4_19 = 'Filipenses 4:19'
export const PROVERBIOS_15_22 = 'Provérbios 15:22'
export const PROVERBIOS_13_11 = 'Provérbios 13:11'
export const LUCAS_16_10 = 'Lucas 16:10'
