/** Formatação em pt-BR usada por todas as telas. */
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarMoeda = (valor: number) => moeda.format(valor)

export const mesReferencia = (data = new Date()) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(data)

export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso + 'T12:00:00'))
