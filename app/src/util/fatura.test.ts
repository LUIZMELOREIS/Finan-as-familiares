import { describe, it, expect } from 'vitest'
import dados from '../../../dados/grupos_categorias.json'
import type { Categoria, ContaFixa } from '../tipos'
import { casarContaFixa, empresaDoTexto, explicarErroDeLeitura, lerFaturaDeTexto, mesclarLeituras, montarLinhas } from './fatura'

const categorias = dados.categorias as Categoria[]

const COPEL = `COPEL DISTRIBUIÇÃO S.A.
CNPJ 04.368.898/0001-06  Inscrição Estadual 90233073-99
Rua José Izidoro Biazetto, 158 - Curitiba - PR
Unidade Consumidora 12345678  Classe Residencial
Mês de referência: 09/2026   Leitura anterior 02/09/2026  Leitura atual 02/10/2026
Consumo kWh 328   Dias 30
Energia elétrica 328 kWh  R$ 284,10
Contrib. Ilum. Pública  R$ 28,37
VENCIMENTO
10/10/2026
TOTAL A PAGAR
R$ 312,47
83640000003-1 12470138000-0 00000012345-6 78901234567-8`

const SANEPAR_PDF = `SANEPAR - Companhia de Saneamento do Paraná
Matrícula: 987654-3
Fatura de Água e Esgoto  Referência OUT/2026
Consumo faturado: 12 m³
Valor Total R$ 168,90   Data de Vencimento 02/11/2026
8366000000 1 6890012345 6 78901234567 8 90123456789 0`

describe('lerFaturaDeTexto', () => {
  it('lê a conta de luz da Copel (valor na linha de baixo do rótulo)', () => {
    const r = lerFaturaDeTexto(COPEL, { categorias })
    expect(r.empresa).toBe('Copel')
    expect(r.valor).toBe(312.47)
    expect(r.vencimento).toBe('2026-10-10')
    expect(r.competencia).toBe('2026-09')
    expect(r.consumo_valor).toBe(328)
    expect(r.consumo_unidade).toBe('kWh')
    expect(r.linha_digitavel?.replace(/\s/g, '')).toHaveLength(48)
    expect(r.cnpj).toBe('04.368.898/0001-06')
    expect(r.categoria_id).toBe('c_luz')
    expect(r.confianca).toBeGreaterThanOrEqual(0.7)
    expect(r.origem_leitura).toBe('regex')
  })

  it('lê a conta de água com mês por extenso e m³', () => {
    const r = lerFaturaDeTexto(SANEPAR_PDF, { categorias })
    expect(r.empresa).toBe('Sanepar')
    expect(r.valor).toBe(168.9)
    expect(r.vencimento).toBe('2026-11-02')
    expect(r.competencia).toBe('2026-10')
    expect(r.consumo_valor).toBe(12)
    expect(r.consumo_unidade).toBe('m³')
    expect(r.categoria_id).toBe('c_agua')
  })

  it('casa a conta fixa pelo código do cliente, depois pelo nome', () => {
    const fixas: ContaFixa[] = [
      { id: 'f_luz', nome: 'Luz da casa', categoria_id: 'c_luz', valor_previsto: 300, dia_vencimento: 10, remetente_email: '', codigo_cliente: '12345678', ativa: true },
      { id: 'f_agua', nome: 'Água — Sanepar', categoria_id: 'c_agua', valor_previsto: 150, dia_vencimento: 2, remetente_email: 'sanepar.com.br', codigo_cliente: '', ativa: true },
      { id: 'f_velha', nome: 'Copel antiga', categoria_id: 'c_luz', valor_previsto: 1, dia_vencimento: 1, remetente_email: '', codigo_cliente: '', ativa: false },
    ]
    expect(lerFaturaDeTexto(COPEL, { contasFixas: fixas }).conta_fixa_id).toBe('f_luz')
    expect(lerFaturaDeTexto(SANEPAR_PDF, { contasFixas: fixas }).conta_fixa_id).toBe('f_agua')
    expect(casarContaFixa('FATURA VIVO FIBRA', 'Vivo', fixas)).toBeUndefined()
  })

  it('sem rótulos usa o maior valor, a última data e a competência padrão', () => {
    const r = lerFaturaDeTexto('Mensalidade 1.480,00\nMulta 12,00\nEmitido em 01/10/2026 pague até 05/11/2026', { competenciaPadrao: '2026-10' })
    expect(r.valor).toBe(1480)
    expect(r.vencimento).toBe('2026-11-05')
    expect(r.competencia).toBe('2026-11')
    expect(r.confianca).toBeLessThan(0.6)
  })

  it('texto vazio não quebra', () => {
    const r = lerFaturaDeTexto('', { competenciaPadrao: '2026-10' })
    expect(r.valor).toBeUndefined()
    expect(r.competencia).toBe('2026-10')
  })
})

describe('empresaDoTexto', () => {
  it('prefere a lista conhecida e não casa "TIM" dentro de outra palavra', () => {
    expect(empresaDoTexto('ÚLTIMA LEITURA 02/10\nESCOLA CRESCER LTDA\nCNPJ 11.111.111/0001-11')).toBe('ESCOLA CRESCER LTDA')
    expect(empresaDoTexto('TIM S.A. fatura')).toBe('TIM')
  })
})

describe('montarLinhas', () => {
  it('agrupa por altura e ordena da esquerda para a direita, de cima para baixo', () => {
    const linhas = montarLinhas([
      { str: 'R$ 312,47', x: 300, y: 100 }, { str: 'TOTAL A PAGAR', x: 10, y: 101 },
      { str: 'VENCIMENTO', x: 10, y: 200 }, { str: '10/10/2026', x: 200, y: 199 }, { str: ' ', x: 0, y: 50 },
    ])
    expect(linhas).toEqual(['VENCIMENTO 10/10/2026', 'TOTAL A PAGAR R$ 312,47'])
  })
})

describe('mesclarLeituras', () => {
  const local = lerFaturaDeTexto(COPEL)
  it('o Claude vence; o anexo sempre vem do servidor', () => {
    const r = mesclarLeituras(local, { confianca: 0.9, origem_leitura: 'claude', valor: 312.47, empresa: 'Copel Distribuição', anexo_url: 'https://drive/x' })
    expect(r.empresa).toBe('Copel Distribuição')
    expect(r.vencimento).toBe('2026-10-10') // completado com o local
    expect(r.anexo_url).toBe('https://drive/x')
  })
  it('OCR/regex do servidor só completa buracos', () => {
    const r = mesclarLeituras(local, { confianca: 0.4, origem_leitura: 'ocr_drive', valor: 999, pix_copia_cola: '000201abc', anexo_url: 'u' })
    expect(r.valor).toBe(312.47)
    expect(r.pix_copia_cola).toBe('000201abc')
    expect(r.anexo_url).toBe('u')
  })
  it('sem local devolve o servidor; sem servidor devolve o local', () => {
    expect(mesclarLeituras(null, { confianca: 0.5, origem_leitura: 'regex', valor: 1 }).valor).toBe(1)
    expect(mesclarLeituras(local, null)).toBe(local)
  })
})

describe('explicarErroDeLeitura', () => {
  it('traduz a falta de OCR/chave em orientação', () => {
    expect(explicarErroDeLeitura(new Error('Serviço avançado Drive não ativado (OCR indisponível)'), false)).toMatch(/CHAVE_API_CLAUDE/)
    expect(explicarErroDeLeitura(new Error('Serviço avançado Drive não ativado (OCR indisponível)'), true)).toMatch(/escaneado/)
    expect(explicarErroDeLeitura(new Error('Família não encontrada'), true)).toBe('Família não encontrada')
  })
})
