import { describe, it, expect } from 'vitest'
import {
  lerValorBr, brl, rotuloDataAlvo, rotuloCompetencia, nomeMesAno, diferencaMeses, completarProjeto, etiquetaSituacao, rotuloVotacao,
  simular, fraseComparacaoAlvo, acumuladoPorMes, patrimonioPorMes, saldoEm, placar, diasAte, divisaoRenda, competenciaReuniao,
} from './calculos'

const base = {
  id: 'p1', nome: 'Viagem', icone: 'plane', foto_url: '', meta_valor: 18000, data_alvo: '2027-06-30', valor_inicial: 240,
  prioridade: 1, status: 'ativo' as const, versiculo: 'Lucas 14:28', criado_por: 'u1', criado_em: '2026-03-10T10:00:00',
}

describe('valores digitados', () => {
  it('lê ponto de milhar à brasileira', () => {
    expect(lerValorBr('3.600')).toBe(3600)
    expect(lerValorBr('R$ 18.000')).toBe(18000)
    expect(lerValorBr('1.234.567')).toBe(1234567)
    expect(lerValorBr('3.600,50')).toBe(3600.5)
    expect(lerValorBr('45,9')).toBe(45.9)
    expect(lerValorBr('1234.56')).toBe(1234.56)
    expect(lerValorBr('690')).toBe(690)
    expect(lerValorBr('')).toBe(0)
  })
})

describe('rótulos', () => {
  it('formata sem centavos como a referência', () => {
    expect(brl(9840).replace(/ /g, ' ')).toBe('R$ 9.840')
    expect(brl(1234.56, 2).replace(/ /g, ' ')).toBe('R$ 1.234,56')
  })
  it('data-alvo em mês/ano, só o ano em dezembro', () => {
    expect(rotuloDataAlvo('2027-06-30')).toBe('jun/2027')
    expect(rotuloDataAlvo('2028-12-01')).toBe('2028')
    expect(rotuloCompetencia('2026-03')).toBe('mar/2026')
    expect(nomeMesAno('2027-06')).toBe('junho de 2027')
  })
  it('conta meses entre competências', () => {
    expect(diferencaMeses('2026-10', '2027-06')).toBe(8)
    expect(diferencaMeses('2027-06', '2026-10')).toBe(-8)
  })
})

describe('situação e votação', () => {
  it('completa campos quando a API não calcula', () => {
    const p = completarProjeto({ ...base, valor_atual: 9840 }, '2026-10')
    expect(p.necessario_mes).toBe(1020) // 8.160 / 8 meses
    expect(p.situacao).toBe('no_ritmo')
    expect(completarProjeto({ ...base, status: 'votação' }, '2026-10').situacao).toBe('votacao')
    expect(completarProjeto({ ...base, valor_atual: 18000 }, '2026-10').situacao).toBe('concluido')
  })
  it('etiquetas por situação', () => {
    expect(etiquetaSituacao({ situacao: 'no_ritmo' })).toEqual({ classe: 'ok', texto: 'No ritmo' })
    expect(etiquetaSituacao({ situacao: 'atrasado', atraso: 1900 }).texto.replace(/ /g, ' ')).toBe('Atrasado R$ 1.900')
    expect(etiquetaSituacao({ situacao: 'votacao' })).toEqual({ classe: 'proj', texto: 'Em votação' })
    expect(etiquetaSituacao({ situacao: 'pausado' }).texto).toBe('Pausado')
  })
  it('selo de votação', () => {
    expect(rotuloVotacao({ situacao: 'no_ritmo', votos_sim: 4, votos_total: 4, aguardando: 0, criado_em: base.criado_em })).toBe('4 de 4 votaram sim')
    expect(rotuloVotacao({ situacao: 'votacao', votos_sim: 2, votos_total: 2, aguardando: 1, criado_em: base.criado_em })).toBe('2 sim · 1 aguardando')
    expect(rotuloVotacao({ situacao: 'atrasado', votos_sim: 0, votos_total: 0, aguardando: 0, criado_em: base.criado_em })).toBe('Aprovado em mar/2026')
  })
})

describe('simulador', () => {
  it('reduzindo R$ 130/mês, a meta fecha antes', () => {
    const p = { meta_valor: 18000, valor_atual: 9840, media_3m: 800, data_alvo: '2027-06-30' }
    const sem = simular(p, 0, '2026-10')
    expect(sem.meses).toBe(11) // 8.160 / 800 = 10,2 → 11
    expect(sem.competencia).toBe('2027-09')
    expect(sem.diferencaAlvo).toBe(3)
    const com = simular(p, 130, '2026-10')
    expect(com.meses).toBe(9) // 8.160 / 930 = 8,8 → 9
    expect(com.competencia).toBe('2027-07')
    expect(fraseComparacaoAlvo(com.diferencaAlvo)).toBe('1 mês depois da data-alvo.')
    expect(fraseComparacaoAlvo(-3)).toBe('3 meses antes da data-alvo.')
    expect(fraseComparacaoAlvo(0)).toBe('Exatamente na data-alvo.')
  })
  it('sem ritmo não fecha; meta atingida fecha já', () => {
    expect(simular({ meta_valor: 1000, valor_atual: 0, media_3m: 0, data_alvo: '2027-01-01' }, 0, '2026-10').meses).toBeNull()
    expect(simular({ meta_valor: 1000, valor_atual: 1000, media_3m: 0, data_alvo: '2027-01-01' }, 0, '2026-10').meses).toBe(0)
  })
})

describe('séries para os gráficos', () => {
  it('acumula aportes mês a mês a partir do valor inicial', () => {
    const pts = acumuladoPorMes(100, [{ data: '2026-01-05', valor: 50 }, { data: '2026-03-05', valor: 200 }, { data: '2026-03-20', valor: 100 }], '2026-02', '2026-04')
    expect(pts).toEqual([{ competencia: '2026-02', valor: 150 }, { competencia: '2026-03', valor: 450 }, { competencia: '2026-04', valor: 450 }])
  })
  it('soma o patrimônio repetindo o último saldo informado', () => {
    const itens = [
      { ativo: true, saldos: [{ competencia: '2026-01', valor: 100 }, { competencia: '2026-03', valor: 300 }] },
      { ativo: true, saldos: [{ competencia: '2026-02', valor: 50 }] },
      { ativo: false, saldos: [{ competencia: '2026-02', valor: 999 }] },
    ]
    expect(patrimonioPorMes(itens, '2026-03', 3).map((p) => p.valor)).toEqual([100, 150, 350])
    expect(saldoEm(itens[0].saldos, '2026-02')).toBe(100)
    expect(saldoEm(itens[1].saldos, '2026-01')).toBeUndefined()
  })
})

describe('conselho, renda e reunião', () => {
  it('placar com quem falta votar', () => {
    const r = placar({ votos: [
      { decisao_id: 'd', usuario_id: 'a', voto: 'sim', comentario: '', data: '' },
      { decisao_id: 'd', usuario_id: 'b', voto: 'não', comentario: '', data: '' },
    ] }, [{ id: 'a', ativo: true }, { id: 'b', ativo: true }, { id: 'c', ativo: true }, { id: 'd', ativo: false }])
    expect(r).toEqual({ sim: 1, nao: 1, abst: 0, total: 3, aguardando: ['c'] })
  })
  it('dias até o prazo', () => {
    expect(diasAte('2026-10-24', new Date(2026, 9, 17))).toBe(7)
    expect(diasAte('2026-10-10', new Date(2026, 9, 17))).toBe(-7)
  })
  it('divisão da renda em percentuais', () => {
    expect(divisaoRenda(10000, 1000, 1500, 8000)).toEqual({ dar: 10, poupar: 15, viver: 70 })
    expect(divisaoRenda(0, 1, 1, 1)).toEqual({ dar: 0, poupar: 0, viver: 0 })
  })
  it('reunião: mês anterior até o dia 10', () => {
    expect(competenciaReuniao(new Date(2026, 9, 8))).toBe('2026-09')
    expect(competenciaReuniao(new Date(2026, 9, 17))).toBe('2026-10')
  })
})
