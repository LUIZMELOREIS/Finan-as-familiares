/** Formatação em pt-BR usada por todas as telas. */
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarMoeda = (valor: number) => moeda.format(valor)

/** "outubro de 2026" → "Outubro de 2026" (só a primeira letra maiúscula). */
export const mesReferencia = (data = new Date()) => {
  const texto = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(data)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso + 'T12:00:00'))
