/**
 * Cálculos puros das telas da família (sonhos, conselho, reunião).
 * Sem React e sem acesso à data de hoje escondido: tudo recebe `hojeIso`
 * para ser testável.
 */
import type { Projeto, Voto, VotoRegistro } from '../../tipos'

interface AporteSimples {
  data: string
  valor: number
}

/** Meses inteiros entre duas datas ISO (mínimo 0) — mesma regra de `mesesAte`. */
export function mesesEntre(hojeIso: string, alvoIso: string): number {
  const [ha, hm] = hojeIso.slice(0, 7).split('-').map(Number)
  const [aa, am] = alvoIso.slice(0, 7).split('-').map(Number)
  if (!ha || !hm || !aa || !am) return 0
  return Math.max(0, (aa - ha) * 12 + (am - hm))
}

/** Soma n meses a uma competência AAAA-MM (sem depender de fuso). */
export function somarCompetencia(comp: string, n: number): string {
  const [a, m] = comp.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  return `${ano}-${String(mes).padStart(2, '0')}`
}

/** Média mensal dos aportes dos últimos `n` meses (contando o mês atual). */
export function mediaUltimosMeses(aportes: AporteSimples[], hojeIso: string, n = 3): number {
  const compHoje = hojeIso.slice(0, 7)
  const compInicio = somarCompetencia(compHoje, -(n - 1))
  const soma = aportes
    .filter((a) => {
      const c = a.data.slice(0, 7)
      return c >= compInicio && c <= compHoje
    })
    .reduce((s, a) => s + a.valor, 0)
  return Math.round((soma / n) * 100) / 100
}

export interface Ritmo {
  /** Quanto ainda falta para a meta (nunca negativo). */
  faltam: number
  /** Meses até a data-alvo (mínimo 0). */
  meses: number
  /** Quanto precisa guardar por mês para chegar na data. */
  necessarioMes: number
  /** Média dos últimos 3 meses de aportes. */
  ritmoAtual: number
  /** true quando a média dos últimos meses alcança o necessário. */
  noRitmo: boolean
  /** Percentual atingido (0–100, com uma casa). */
  pct: number
  concluido: boolean
}

export function calcularRitmo(
  projeto: Pick<Projeto, 'meta_valor' | 'data_alvo'> & { valor_atual?: number },
  aportes: AporteSimples[],
  hojeIso: string,
): Ritmo {
  const atual = projeto.valor_atual ?? 0
  const faltam = Math.max(0, Math.round((projeto.meta_valor - atual) * 100) / 100)
  const meses = mesesEntre(hojeIso, projeto.data_alvo)
  const necessarioMes = Math.round((faltam / Math.max(1, meses)) * 100) / 100
  const ritmoAtual = mediaUltimosMeses(aportes, hojeIso)
  const pct = projeto.meta_valor > 0 ? Math.min(100, Math.round((atual / projeto.meta_valor) * 1000) / 10) : 0
  const concluido = faltam <= 0
  return { faltam, meses, necessarioMes, ritmoAtual, noRitmo: concluido || ritmoAtual >= necessarioMes, pct, concluido }
}

/** Quantos meses faltam guardando `aporteMensal` por mês. `null` = nunca chega (aporte zero). */
export function mesesParaMeta(faltam: number, aporteMensal: number): number | null {
  if (faltam <= 0) return 0
  if (aporteMensal <= 0) return null
  return Math.ceil(faltam / aporteMensal)
}

export interface Simulacao {
  mesesSemCorte: number | null
  mesesComCorte: number | null
  /** Quantos meses a meta sai antes (null quando não dá para comparar). */
  mesesAntes: number | null
  /** Competência estimada de chegada com o corte (null = sem previsão). */
  competenciaComCorte: string | null
}

/** "E se cortássemos R$ X por mês?" */
export function simularCorte(faltam: number, aporteAtual: number, corte: number, hojeIso: string): Simulacao {
  const mesesSemCorte = mesesParaMeta(faltam, aporteAtual)
  const mesesComCorte = mesesParaMeta(faltam, aporteAtual + corte)
  const mesesAntes = mesesSemCorte !== null && mesesComCorte !== null ? Math.max(0, mesesSemCorte - mesesComCorte) : null
  const competenciaComCorte = mesesComCorte !== null ? somarCompetencia(hojeIso.slice(0, 7), mesesComCorte) : null
  return { mesesSemCorte, mesesComCorte, mesesAntes, competenciaComCorte }
}

/** Qual marco (25/50/75/100) foi cruzado entre dois percentuais; o maior deles. */
export function marcoCruzado(pctAntes: number, pctDepois: number): 25 | 50 | 75 | 100 | null {
  const marcos = [100, 75, 50, 25] as const
  for (const m of marcos) if (pctAntes < m && pctDepois >= m) return m
  return null
}

/** Evolução acumulada por mês (valor inicial + aportes até cada competência). */
export function evolucaoAcumulada(aportes: AporteSimples[], valorInicial: number, deComp: string, ateComp: string): Array<{ competencia: string; total: number }> {
  const inicio = deComp <= ateComp ? deComp : ateComp
  const n = Math.min(60, mesesEntre(inicio + '-01', ateComp + '-01'))
  const porMes = new Map<string, number>()
  for (const a of aportes) {
    const c = a.data.slice(0, 7)
    porMes.set(c, (porMes.get(c) ?? 0) + a.valor)
  }
  // Aportes anteriores ao primeiro mês entram no ponto de partida.
  let acumulado = valorInicial + aportes.filter((a) => a.data.slice(0, 7) < inicio).reduce((s, a) => s + a.valor, 0)
  const saida: Array<{ competencia: string; total: number }> = []
  for (let i = 0; i <= n; i++) {
    const comp = somarCompetencia(inicio, i)
    acumulado += porMes.get(comp) ?? 0
    saida.push({ competencia: comp, total: Math.round(acumulado * 100) / 100 })
  }
  return saida
}

/** Ordena: votação/ativo/pausado por prioridade; concluídos no fim. */
export function ordenarProjetos<T extends Pick<Projeto, 'prioridade' | 'status'>>(projetos: T[]): T[] {
  const peso = (p: T) => (p.status === 'concluído' ? 1 : 0)
  return [...projetos].sort((a, b) => peso(a) - peso(b) || a.prioridade - b.prioridade)
}

/** Dias inteiros até o prazo (negativo = vencido). */
export function diasRestantes(prazoIso: string, hojeIso: string): number {
  const dia = (iso: string) => {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  return Math.round((dia(prazoIso) - dia(hojeIso)) / 86_400_000)
}

/** Data ISO `dias` à frente de hoje. */
export function dataMaisDias(hojeIso: string, dias: number): string {
  const [a, m, d] = hojeIso.slice(0, 10).split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d + dias))
  return t.toISOString().slice(0, 10)
}

export interface Placar {
  sim: number
  nao: number
  abster: number
  total: number
}

export function placar(votos: Array<Pick<VotoRegistro, 'voto'>> = []): Placar {
  const contar = (v: Voto) => votos.filter((x) => x.voto === v).length
  const sim = contar('sim')
  const nao = contar('não')
  const abster = contar('abster')
  return { sim, nao, abster, total: sim + nao + abster }
}

/** Aplica a regra de votação configurada (mesma lógica do servidor). */
export function decidirResultado(votos: VotoRegistro[], idsAdministradores: string[], regra: 'maioria' | 'maioria_mais_pais'): 'aprovada' | 'recusada' {
  const p = placar(votos)
  let aprovada = p.sim > p.nao
  if (regra === 'maioria_mais_pais') {
    const paiContra = votos.some((v) => idsAdministradores.includes(v.usuario_id) && v.voto === 'não')
    aprovada = aprovada && !paiContra
  }
  return aprovada ? 'aprovada' : 'recusada'
}

/** Nos primeiros 10 dias do mês a reunião olha para o mês anterior. */
export function competenciaReuniaoPadrao(hojeIso: string): string {
  const dia = Number(hojeIso.slice(8, 10))
  const comp = hojeIso.slice(0, 7)
  return dia <= 10 ? somarCompetencia(comp, -1) : comp
}
