import type { FormaPgto, Lancamento, LeituraExtraida, OrigemLancamento, TipoLancamento } from '../../tipos'
import { hojeIso } from '../../util/formato'

/** Lançamento em construção na tela /lancar (antes de virar `Lancamento`). */
export interface Rascunho {
  id?: string
  tipo: TipoLancamento
  valor: number
  categoria_id: string
  descricao: string
  estabelecimento: string
  data: string // ISO aaaa-mm-dd
  forma_pgto: FormaPgto
  cartao_id?: string
  parcelas: number
  usuario_id: string
  anexo_url?: string
  previa?: string // URL local da foto para mostrar
  origem: OrigemLancamento
  projeto_id?: string
  competencia?: string
  status?: Lancamento['status']
}

export function rascunhoVazio(usuarioId: string, tipo: TipoLancamento = 'despesa'): Rascunho {
  return { tipo, valor: 0, categoria_id: '', descricao: '', estabelecimento: '', data: hojeIso(), forma_pgto: 'pix', parcelas: 1, usuario_id: usuarioId, origem: 'manual' }
}

export function rascunhoDeLancamento(l: Lancamento): Rascunho {
  const parcelas = l.parcela ? Number(l.parcela.split('/')[1]) || 1 : 1
  return {
    id: l.id, tipo: l.tipo, valor: l.valor, categoria_id: l.categoria_id, descricao: l.descricao, estabelecimento: l.estabelecimento,
    data: l.data.includes('/') ? l.data.split('/').reverse().join('-') : l.data.slice(0, 10),
    forma_pgto: l.forma_pgto, cartao_id: l.cartao_id, parcelas, usuario_id: l.usuario_id, anexo_url: l.anexo_url, previa: l.anexo_url,
    origem: l.origem, projeto_id: l.projeto_id, competencia: l.competencia, status: l.status,
  }
}

/** Aplica o que a leitura (foto/voz/NFC-e) encontrou por cima do rascunho. */
export function aplicarLeitura(r: Rascunho, le: LeituraExtraida, origem: OrigemLancamento): Rascunho {
  return {
    ...r,
    origem,
    valor: le.valor ?? r.valor,
    data: le.data && /^\d{4}-\d{2}-\d{2}/.test(le.data) ? le.data.slice(0, 10) : r.data,
    estabelecimento: le.estabelecimento ?? r.estabelecimento,
    descricao: le.descricao || le.estabelecimento || r.descricao,
    forma_pgto: le.forma_pgto ?? r.forma_pgto,
    categoria_id: le.categoria_id || r.categoria_id,
    anexo_url: le.anexo_url || r.anexo_url,
  }
}

/** Monta o `Lancamento` que vai para a API. */
export function paraLancamento(r: Rascunho): Lancamento {
  return {
    id: r.id ?? '',
    data: r.data,
    competencia: r.competencia ?? r.data.slice(0, 7),
    tipo: r.tipo,
    valor: r.valor,
    categoria_id: r.categoria_id,
    descricao: r.descricao || r.estabelecimento,
    estabelecimento: r.estabelecimento || r.descricao,
    forma_pgto: r.forma_pgto,
    cartao_id: r.forma_pgto === 'crédito' ? r.cartao_id : undefined,
    usuario_id: r.usuario_id,
    origem: r.origem,
    anexo_url: r.anexo_url,
    status: r.status ?? 'confirmado',
    criado_em: '',
    projeto_id: r.projeto_id,
  }
}
