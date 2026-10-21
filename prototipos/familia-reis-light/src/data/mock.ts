/** Dados de exemplo da Família Reis. Troque por chamadas à API quando houver back-end. */
export type Membro = 'Pai' | 'Mãe' | 'Filho' | 'Filha'
export type Categoria = 'mercado' | 'transporte' | 'lazer' | 'saude' | 'casa' | 'educacao' | 'renda'

export interface Transacao {
  id: string
  data: string          // AAAA-MM-DD
  loja: string
  valor: number         // negativo = saída, positivo = entrada
  categoria: Categoria
  membro: Membro
}

export const FAMILIA = 'Família Reis'

export const RESUMO = {
  saldo: 4250,
  entradas: 8000,
  saidas: 3750,
  limiteMensal: 6000,
  contasPendentes: 2,
}

export const CORES_MEMBRO: Record<Membro, string> = {
  Pai: '#005F73',
  Mãe: '#9B2226',
  Filho: '#2D6A4F',
  Filha: '#BB3E03',
}

export const TRANSACOES: Transacao[] = [
  { id: 't1', data: '2026-10-21', loja: 'Supermercado Bom Preço', valor: -312.4, categoria: 'mercado', membro: 'Mãe' },
  { id: 't2', data: '2026-10-21', loja: 'Posto Shell', valor: -180, categoria: 'transporte', membro: 'Pai' },
  { id: 't3', data: '2026-10-20', loja: 'Cinema Cinemark', valor: -64, categoria: 'lazer', membro: 'Filho' },
  { id: 't4', data: '2026-10-19', loja: 'Farmácia Nissei', valor: -97.9, categoria: 'saude', membro: 'Mãe' },
  { id: 't5', data: '2026-10-18', loja: 'Copel (luz)', valor: -412, categoria: 'casa', membro: 'Pai' },
  { id: 't6', data: '2026-10-17', loja: 'Livraria Curitiba', valor: -89.9, categoria: 'educacao', membro: 'Filha' },
  { id: 't7', data: '2026-10-15', loja: 'Uber', valor: -27.5, categoria: 'transporte', membro: 'Filha' },
  { id: 't8', data: '2026-10-05', loja: 'Salário', valor: 8000, categoria: 'renda', membro: 'Pai' },
]
