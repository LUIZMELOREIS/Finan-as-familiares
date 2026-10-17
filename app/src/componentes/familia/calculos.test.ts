import { describe, it, expect } from 'vitest'
import {
  mesesEntre, somarCompetencia, mediaUltimosMeses, calcularRitmo, mesesParaMeta, simularCorte,
  marcoCruzado, evolucaoAcumulada, ordenarProjetos, diasRestantes, dataMaisDias, placar, decidirResultado, competenciaReuniaoPadrao,
} from './calculos'

const HOJE = '2026-10-17'

describe('ritmo dos sonhos', () => {
  it('conta meses inteiros até a data-alvo (mínimo 0)', () => {
    expect(mesesEntre(HOJE, '2027-05-15')).toBe(7)
    expect(mesesEntre(HOJE, '2026-10-30')).toBe(0)
    expect(mesesEntre(HOJE, '2025-01-01')).toBe(0)
  })
  it('soma competências virando o ano', () => {
    expect(somarCompetencia('2026-10', 3)).toBe('2027-01')
    expect(somarCompetencia('2026-01', -1)).toBe('2025-12')
  })
  it('faz a média dos últimos 3 meses (contando o atual)', () => {
    const aportes = [
      { data: '2026-10-05', valor: 300 },
      { data: '2026-09-05', valor: 300 },
      { data: '2026-08-05', valor: 300 },
      { data: '2026-07-05', valor: 9000 }, // fora da janela
    ]
    expect(mediaUltimosMeses(aportes, HOJE)).toBe(300)
    expect(mediaUltimosMeses([], HOJE)).toBe(0)
  })
  it('calcula quanto falta, o necessário por mês e se está no ritmo', () => {
    const r = calcularRitmo({ meta_valor: 12000, valor_atual: 4500, data_alvo: '2027-05-15' }, [
      { data: '2026-10-06', valor: 800 }, { data: '2026-09-06', valor: 800 }, { data: '2026-08-06', valor: 800 },
    ], HOJE)
    expect(r.faltam).toBe(7500)
    expect(r.meses).toBe(7)
    expect(r.necessarioMes).toBe(1071.43)
    expect(r.ritmoAtual).toBe(800)
    expect(r.noRitmo).toBe(false)
    expect(r.pct).toBe(37.5)
  })
  it('com data-alvo já passada usa pelo menos 1 mês e marca concluído quando bateu a meta', () => {
    const r = calcularRitmo({ meta_valor: 900, valor_atual: 900, data_alvo: '2026-01-01' }, [], HOJE)
    expect(r.faltam).toBe(0)
    expect(r.necessarioMes).toBe(0)
    expect(r.concluido).toBe(true)
    expect(r.noRitmo).toBe(true)
  })
  it('meses para a meta e simulação de corte', () => {
    expect(mesesParaMeta(7500, 800)).toBe(10)
    expect(mesesParaMeta(7500, 0)).toBeNull()
    expect(mesesParaMeta(0, 0)).toBe(0)
    const s = simularCorte(7500, 800, 300, HOJE)
    expect(s.mesesSemCorte).toBe(10)
    expect(s.mesesComCorte).toBe(7)
    expect(s.mesesAntes).toBe(3)
    expect(s.competenciaComCorte).toBe('2027-05')
    const semRitmo = simularCorte(7500, 0, 500, HOJE)
    expect(semRitmo.mesesSemCorte).toBeNull()
    expect(semRitmo.mesesComCorte).toBe(15)
    expect(semRitmo.mesesAntes).toBeNull()
  })
  it('detecta o marco cruzado (25/50/75/100)', () => {
    expect(marcoCruzado(20, 26)).toBe(25)
    expect(marcoCruzado(49.9, 50)).toBe(50)
    expect(marcoCruzado(10, 100)).toBe(100)
    expect(marcoCruzado(30, 40)).toBeNull()
    expect(marcoCruzado(100, 100)).toBeNull()
  })
  it('monta a evolução acumulada mês a mês', () => {
    const ev = evolucaoAcumulada([
      { data: '2026-08-10', valor: 100 }, { data: '2026-10-01', valor: 50 }, { data: '2026-06-01', valor: 20 },
    ], 1000, '2026-08', '2026-10')
    expect(ev).toEqual([
      { competencia: '2026-08', total: 1120 },
      { competencia: '2026-09', total: 1120 },
      { competencia: '2026-10', total: 1170 },
    ])
  })
  it('ordena por prioridade com os concluídos no fim', () => {
    const lista = ordenarProjetos([
      { id: 'a', prioridade: 2, status: 'ativo' as const },
      { id: 'b', prioridade: 1, status: 'concluído' as const },
      { id: 'c', prioridade: 1, status: 'votação' as const },
    ])
    expect(lista.map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('conselho e reunião', () => {
  it('dias restantes e prazo padrão', () => {
    expect(diasRestantes('2026-10-24', HOJE)).toBe(7)
    expect(diasRestantes('2026-10-10', HOJE)).toBe(-7)
    expect(dataMaisDias(HOJE, 7)).toBe('2026-10-24')
    expect(dataMaisDias('2026-12-28', 7)).toBe('2027-01-04')
  })
  it('conta o placar', () => {
    expect(placar([{ voto: 'sim' }, { voto: 'sim' }, { voto: 'não' }, { voto: 'abster' }])).toEqual({ sim: 2, nao: 1, abster: 1, total: 4 })
    expect(placar()).toEqual({ sim: 0, nao: 0, abster: 0, total: 0 })
  })
  it('aplica a regra "maioria" e "maioria + pais"', () => {
    const votos = [
      { decisao_id: 'd', usuario_id: 'pai', voto: 'não' as const, comentario: '', data: HOJE },
      { decisao_id: 'd', usuario_id: 'ju', voto: 'sim' as const, comentario: '', data: HOJE },
      { decisao_id: 'd', usuario_id: 'pedro', voto: 'sim' as const, comentario: '', data: HOJE },
    ]
    expect(decidirResultado(votos, ['pai'], 'maioria')).toBe('aprovada')
    expect(decidirResultado(votos, ['pai'], 'maioria_mais_pais')).toBe('recusada')
    expect(decidirResultado([], ['pai'], 'maioria')).toBe('recusada')
  })
  it('nos primeiros 10 dias a reunião olha o mês anterior', () => {
    expect(competenciaReuniaoPadrao('2026-10-05')).toBe('2026-09')
    expect(competenciaReuniaoPadrao('2026-10-17')).toBe('2026-10')
    expect(competenciaReuniaoPadrao('2026-01-03')).toBe('2025-12')
  })
})
