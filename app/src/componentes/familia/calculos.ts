/**
 * Cálculos das telas da família (Projetos, Conselho, Patrimônio, Mesada):
 * ritmo de um projeto, simulador "reduzindo X por mês, a meta fecha em…",
 * rótulos de data-alvo e de votação, acumulado por mês para os gráficos.
 * Funções puras, sem React, cobertas por calculos.test.ts.
 */
import type { CorPaleta, Decisao, Projeto, Usuario, VotoRegistro } from '../../tipos'
import { MESES, lerValor, somarMeses } from '../../util/formato'

export type Situacao = 'no_ritmo' | 'atrasado' | 'votacao' | 'concluido' | 'pausado'

/** Projeto como vem de `listar_projetos` (campos calculados pelo servidor/mock). */
export interface ProjetoCalculado extends Projeto {
  cor?: CorPaleta
  necessario_mes?: number
  media_3m?: number
  situacao?: Situacao
  atraso?: number
  votos_sim?: number
  votos_total?: number
  aguardando?: number
}

/** Cores padrão dos projetos, pela ordem em que aparecem (igual à referência: ouro, verde, índigo…). */
export const CORES_PROJETO: CorPaleta[] = ['gold', 'green', 'indigo', 'magenta', 'orange', 'lilac', 'rose', 'slate']

/** "R$ 9.840" (sem centavos) como nos cards da referência; `d` casas decimais. */
export function brl(v: number | undefined | null, d = 0): string {
  return 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/**
 * Lê um valor digitado à brasileira: "3.600" é três mil e seiscentos (ponto de milhar),
 * "3.600,50" idem com centavos, "45,9" é 45,90. Só trata o ponto como decimal quando
 * não há vírgula e o padrão não é de milhar (ex.: "1234.56").
 */
export function lerValorBr(texto: string): number {
  const t = (texto || '').replace(/[R$\s]/g, '')
  if (!t.includes(',') && /^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''))
  return lerValor(t)
}

const MESES_MIN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2027-06-30" → "jun/2027"; dezembro vira só o ano: "2028-12-01" → "2028". */
export function rotuloDataAlvo(iso: string | undefined): string {
  if (!iso) return '—'
  const [a, m] = iso.slice(0, 10).split('-').map(Number)
  if (!a || !m) return iso
  return m === 12 ? String(a) : `${MESES_MIN[m - 1]}/${a}`
}

/** "2027-06" → "jun/2027" (competência curta, minúscula, como na referência). */
export function rotuloCompetencia(comp: string): string {
  const [a, m] = comp.split('-').map(Number)
  if (!a || !m) return comp
  return `${MESES_MIN[m - 1]}/${a}`
}

/** "2027-06" → "junho de 2027" (para frases: "a meta fecha em junho de 2027"). */
export function nomeMesAno(comp: string): string {
  const [a, m] = comp.split('-').map(Number)
  if (!a || !m) return comp
  return `${MESES[m - 1].toLowerCase()} de ${a}`
}

/** Meses inteiros entre duas competências AAAA-MM (b − a). */
export function diferencaMeses(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number)
  const [ba, bm] = b.split('-').map(Number)
  return (ba - aa) * 12 + (bm - am)
}

/** Quanto falta para a meta (nunca negativo). */
export function falta(p: Pick<ProjetoCalculado, 'meta_valor' | 'valor_atual'>): number {
  return Math.max(0, p.meta_valor - (p.valor_atual ?? 0))
}

/** Percentual da meta já guardado, 0–100. */
export function percentualMeta(p: Pick<ProjetoCalculado, 'meta_valor' | 'valor_atual'>): number {
  if (!p.meta_valor) return 0
  return Math.max(0, Math.min(100, ((p.valor_atual ?? 0) / p.meta_valor) * 100))
}

/**
 * Completa os campos calculados quando a API não os devolve (versão 1 do servidor):
 * quanto guardar por mês pela data-alvo e a situação pelo status.
 */
export function completarProjeto(p: ProjetoCalculado, compAtual: string): Required<Pick<ProjetoCalculado, 'necessario_mes' | 'media_3m' | 'situacao' | 'atraso' | 'votos_sim' | 'votos_total' | 'aguardando' | 'valor_atual'>> & ProjetoCalculado {
  const valor_atual = p.valor_atual ?? p.valor_inicial ?? 0
  const meses = Math.max(1, diferencaMeses(compAtual, p.data_alvo.slice(0, 7)))
  const necessario_mes = p.necessario_mes ?? Math.round(falta({ meta_valor: p.meta_valor, valor_atual }) / meses)
  const media_3m = p.media_3m ?? 0
  const situacao: Situacao = p.situacao ?? (
    p.status === 'votação' ? 'votacao'
      : p.status === 'concluído' ? 'concluido'
        : p.status === 'pausado' ? 'pausado'
          : valor_atual >= p.meta_valor ? 'concluido'
            : p.media_3m === undefined ? 'no_ritmo' : media_3m >= necessario_mes * 0.95 ? 'no_ritmo' : 'atrasado')
  return {
    ...p, valor_atual, necessario_mes, media_3m, situacao,
    atraso: p.atraso ?? Math.max(0, Math.round((necessario_mes - media_3m) * 3)),
    votos_sim: p.votos_sim ?? 0, votos_total: p.votos_total ?? 0, aguardando: p.aguardando ?? 0,
  }
}

/** Etiqueta do card: classe e texto, conforme a situação. */
export function etiquetaSituacao(p: Pick<ProjetoCalculado, 'situacao' | 'atraso'>): { classe: 'ok' | 'warn' | 'proj' | 'red'; texto: string } {
  switch (p.situacao) {
    case 'atrasado': return { classe: 'warn', texto: `Atrasado ${brl(p.atraso ?? 0)}` }
    case 'votacao': return { classe: 'proj', texto: 'Em votação' }
    case 'concluido': return { classe: 'ok', texto: 'Concluído' }
    case 'pausado': return { classe: 'proj', texto: 'Pausado' }
    default: return { classe: 'ok', texto: 'No ritmo' }
  }
}

/**
 * Texto do selo de votação: "4 de 4 votaram sim" (aprovado por votação),
 * "2 sim · 1 aguardando" (em votação) ou "Aprovado em mar/2026" (sem votação registrada).
 */
export function rotuloVotacao(p: Pick<ProjetoCalculado, 'situacao' | 'votos_sim' | 'votos_total' | 'aguardando' | 'criado_em'>): string {
  const sim = p.votos_sim ?? 0, total = p.votos_total ?? 0, aguardando = p.aguardando ?? 0
  if (p.situacao === 'votacao') return `${sim} sim · ${aguardando} aguardando`
  if (total > 0) return `${sim} de ${total} votaram sim`
  return `Aprovado em ${rotuloCompetencia(p.criado_em.slice(0, 7))}`
}

export interface ResultadoSimulacao {
  /** Meses até fechar a meta com o ritmo atual + corte; `null` quando o ritmo é zero. */
  meses: number | null
  /** Competência AAAA-MM em que a meta fecha. */
  competencia: string | null
  /** Diferença em meses em relação à data-alvo (negativo = antes da data-alvo). */
  diferencaAlvo: number | null
}

/**
 * Simulador: "reduzindo delivery em R$ 130/mês, a meta fecha em junho".
 * meses = teto(falta / (média dos últimos 3 meses + corte)).
 */
export function simular(p: Pick<ProjetoCalculado, 'meta_valor' | 'valor_atual' | 'media_3m' | 'data_alvo'>, corte: number, compAtual: string): ResultadoSimulacao {
  const restante = falta(p)
  if (restante <= 0) return { meses: 0, competencia: compAtual, diferencaAlvo: diferencaMeses(p.data_alvo.slice(0, 7), compAtual) }
  const ritmo = (p.media_3m ?? 0) + corte
  if (ritmo <= 0) return { meses: null, competencia: null, diferencaAlvo: null }
  const meses = Math.ceil(restante / ritmo)
  const competencia = somarMeses(compAtual, meses)
  return { meses, competencia, diferencaAlvo: diferencaMeses(p.data_alvo.slice(0, 7), competencia) }
}

/** Frase da comparação com a data-alvo, sóbria. */
export function fraseComparacaoAlvo(diferenca: number | null): string {
  if (diferenca === null) return 'Sem aportes mensais a meta não fecha; comece com um valor pequeno e constante.'
  if (diferenca === 0) return 'Exatamente na data-alvo.'
  const n = Math.abs(diferenca)
  const un = n === 1 ? 'mês' : 'meses'
  return diferenca < 0 ? `${n} ${un} antes da data-alvo.` : `${n} ${un} depois da data-alvo.`
}

/** Pontos (competência, valor) do acumulado mês a mês: valor inicial + soma dos aportes até cada mês. */
export function acumuladoPorMes(valorInicial: number, aportes: Array<{ data: string; valor: number }>, de: string, ate: string): Array<{ competencia: string; valor: number }> {
  const n = Math.max(0, diferencaMeses(de, ate))
  const porMes = new Map<string, number>()
  let antes = 0
  for (const a of aportes) {
    const c = a.data.slice(0, 7)
    if (c < de) antes += a.valor
    else porMes.set(c, (porMes.get(c) ?? 0) + a.valor)
  }
  let acumulado = valorInicial + antes
  const pontos: Array<{ competencia: string; valor: number }> = []
  for (let i = 0; i <= n; i++) {
    const c = somarMeses(de, i)
    acumulado += porMes.get(c) ?? 0
    pontos.push({ competencia: c, valor: Math.round(acumulado * 100) / 100 })
  }
  return pontos
}

/** Soma dos saldos de patrimônio por competência (últimos `n` meses até `ate`). Sem saldo no mês, repete o último informado. */
export function patrimonioPorMes(itens: Array<{ saldos: Array<{ competencia: string; valor: number }>; ativo?: boolean }>, ate: string, n = 12): Array<{ competencia: string; valor: number }> {
  const comps = Array.from({ length: n }, (_, i) => somarMeses(ate, i - (n - 1)))
  return comps.map((c) => ({
    competencia: c,
    valor: itens.filter((it) => it.ativo !== false).reduce((s, it) => s + (saldoEm(it.saldos, c) ?? 0), 0),
  }))
}

/** Saldo informado em uma competência ou, se não houver, o último anterior a ela. */
export function saldoEm(saldos: Array<{ competencia: string; valor: number }>, comp: string): number | undefined {
  const ate = saldos.filter((s) => s.competencia <= comp).sort((a, b) => (a.competencia < b.competencia ? 1 : -1))
  return ate[0]?.valor
}

/** Placar de uma decisão: contagens e quem ainda não votou. */
export function placar(d: Pick<Decisao, 'votos'>, membros: Pick<Usuario, 'id' | 'ativo'>[]) {
  const votos: VotoRegistro[] = d.votos ?? []
  const sim = votos.filter((v) => v.voto === 'sim').length
  const nao = votos.filter((v) => v.voto === 'não').length
  const abst = votos.filter((v) => v.voto === 'abster').length
  const ativos = membros.filter((m) => m.ativo !== false)
  const votaram = new Set(votos.map((v) => v.usuario_id))
  const aguardando = ativos.filter((m) => !votaram.has(m.id)).map((m) => m.id)
  return { sim, nao, abst, total: ativos.length, aguardando }
}

/** Dias que faltam para um prazo ISO (negativo = vencido). */
export function diasAte(iso: string, hoje = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const alvo = Date.UTC(a, m - 1, d)
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo - agora) / 86_400_000)
}

/** Divisão da renda Dar → Poupar → Viver: percentuais realizados sobre a receita do mês. */
export function divisaoRenda(receita: number, dar: number, poupar: number, saiu: number): { dar: number; poupar: number; viver: number } {
  if (!receita) return { dar: 0, poupar: 0, viver: 0 }
  const pct = (v: number) => Math.round((v / receita) * 1000) / 10
  return { dar: pct(dar), poupar: pct(poupar), viver: pct(Math.max(0, saiu - dar)) }
}

/** Competência padrão da reunião: o mês anterior até o dia 10, depois o mês atual. */
export function competenciaReuniao(hoje = new Date()): string {
  const comp = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return hoje.getDate() <= 10 ? somarMeses(comp, -1) : comp
}
