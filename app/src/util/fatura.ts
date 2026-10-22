/**
 * Leitura de faturas (luz, água, gás, internet, telefone…) no próprio aparelho.
 *
 * 1. `textoDoPdf` extrai o texto de um PDF com o pdf.js — sem mandar nada para o servidor.
 * 2. `lerFaturaDeTexto` aplica regras (regex) sobre esse texto: empresa, valor, vencimento,
 *    competência, linha digitável, Pix, consumo e a conta fixa/categoria mais provável.
 *
 * O servidor (`ler_imagem`) continua sendo chamado para guardar o anexo no Drive e, quando
 * há chave do Claude, melhorar a leitura; mas a fatura já fica preenchida mesmo sem ele.
 */
import type { Categoria, ContaFixa, LeituraExtraida } from '../tipos'
import { competenciaDe, lerValor, normalizar } from './formato'
import { sugerirCategoria } from './extrator'

/** Empresas conhecidas → nome amigável. A chave é comparada com o texto normalizado (maiúsculo, sem acento). */
const EMPRESAS: Array<[string, string]> = [
  ['COPEL', 'Copel'], ['CELESC', 'Celesc'], ['CEMIG', 'Cemig'], ['ENEL', 'Enel'], ['LIGHT', 'Light'], ['CPFL', 'CPFL'],
  ['ENERGISA', 'Energisa'], ['EQUATORIAL', 'Equatorial'], ['ELEKTRO', 'Elektro'], ['NEOENERGIA', 'Neoenergia'], ['COELBA', 'Coelba'],
  ['RGE', 'RGE'], ['EDP', 'EDP'],
  ['SANEPAR', 'Sanepar'], ['SABESP', 'Sabesp'], ['COPASA', 'Copasa'], ['CEDAE', 'Cedae'], ['CAESB', 'Caesb'], ['EMBASA', 'Embasa'], ['CORSAN', 'Corsan'], ['CASAN', 'Casan'],
  ['COMPAGAS', 'Compagas'], ['COMGAS', 'Comgás'], ['ULTRAGAZ', 'Ultragaz'], ['LIQUIGAS', 'Liquigás'], ['SUPERGASBRAS', 'Supergasbras'],
  ['VIVO', 'Vivo'], ['CLARO', 'Claro'], ['TIM', 'TIM'], ['OI ', 'Oi'], ['SKY', 'Sky'], ['ALGAR', 'Algar'],
  ['UNIMED', 'Unimed'], ['AMIL', 'Amil'], ['BRADESCO SAUDE', 'Bradesco Saúde'], ['SULAMERICA', 'SulAmérica'], ['HAPVIDA', 'Hapvida'],
  ['NETFLIX', 'Netflix'], ['SPOTIFY', 'Spotify'],
]

const MESES: Record<string, string> = {
  JAN: '01', JANEIRO: '01', FEV: '02', FEVEREIRO: '02', MAR: '03', MARCO: '03', ABR: '04', ABRIL: '04', MAI: '05', MAIO: '05', JUN: '06', JUNHO: '06',
  JUL: '07', JULHO: '07', AGO: '08', AGOSTO: '08', SET: '09', SETEMBRO: '09', OUT: '10', OUTUBRO: '10', NOV: '11', NOVEMBRO: '11', DEZ: '12', DEZEMBRO: '12',
}

const RE_DINHEIRO = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/

function dataIsoDeBr(br: string): string {
  const [d, m, a] = br.split('/')
  return `${a}-${m}-${d}`
}

function dataValida(iso: string): boolean {
  const [a, m, d] = iso.split('-').map(Number)
  return a >= 2000 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
}

/** Agrupa os pedaços de texto do pdf.js em linhas (mesma altura, da esquerda para a direita). */
export function montarLinhas(itens: Array<{ str: string; x: number; y: number }>): string[] {
  const linhas: Array<{ y: number; partes: Array<{ x: number; str: string }> }> = []
  for (const it of itens) {
    if (!it.str.trim()) continue
    const linha = linhas.find((l) => Math.abs(l.y - it.y) <= 2.5)
    if (linha) linha.partes.push({ x: it.x, str: it.str })
    else linhas.push({ y: it.y, partes: [{ x: it.x, str: it.str }] })
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Extrai o texto de um PDF no aparelho (até `maxPaginas` páginas). Devolve '' para PDF só de imagem (escaneado). */
export async function textoDoPdf(arquivo: Blob, maxPaginas = 4): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
  const doc = await tarefa.promise
  const paginas: string[] = []
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPaginas); p++) {
      const pagina = await doc.getPage(p)
      const conteudo = await pagina.getTextContent()
      const itens = conteudo.items
        .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && Array.isArray((i as { transform?: unknown }).transform))
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }))
      paginas.push(montarLinhas(itens).join('\n'))
    }
  } finally {
    await tarefa.destroy().catch(() => {})
  }
  return paginas.join('\n\n')
}

export interface OpcoesLeitura {
  competenciaPadrao?: string
  categorias?: Categoria[]
  contasFixas?: ContaFixa[]
}

/** Nome da empresa a partir do texto: lista conhecida, senão a primeira linha "de nome". */
export function empresaDoTexto(texto: string): string | undefined {
  const t = ' ' + normalizar(texto) + ' '
  for (const [chave, nome] of EMPRESAS) {
    const k = chave.trim()
    if (k.length <= 3 ? new RegExp(`(^|\\s)${k}(\\s|$)`).test(t) : t.includes(k)) return nome
  }
  const linhas = texto.split('\n').map((s) => s.trim()).filter((s) => /[A-Za-zÀ-ú]{4,}/.test(s) && !/CNPJ|CPF|CEP|\d{5}-?\d{3}|@|HTTP|WWW/i.test(s) && (s.match(/\d/g) || []).length < 6)
  const linha = linhas.find((s) => /\b(LTDA|S\.?A\.?|S\/A|EIRELI|COMPANHIA|CIA\.?|DISTRIBUI|ENERGIA|SANEAMENTO|TELECOM|ESCOLA|COL[EÉ]GIO|FACULDADE|UNIVERSIDADE|CONDOM[IÍ]NIO|PREFEITURA)\b/i.test(s))
    ?? linhas.find((s) => !/\d/.test(s)) ?? linhas[0]
  return linha ? linha.slice(0, 60) : undefined
}

/** Casa a conta fixa pelo código de cliente, remetente ou nome. */
export function casarContaFixa(texto: string, empresa: string | undefined, contasFixas: ContaFixa[]): ContaFixa | undefined {
  const t = normalizar(texto)
  const emp = normalizar(empresa || '')
  const ativas = contasFixas.filter((f) => f.ativa !== false)
  // Números "colados" (12.345-6 → 123456), mas sem juntar números separados por espaço — senão a linha digitável casa qualquer código.
  const numeros = texto.replace(/(\d)[.\-/](?=\d)/g, '$1')
  return ativas.find((f) => { const cod = f.codigo_cliente.replace(/\D/g, ''); return cod.length >= 5 && new RegExp(`(^|\\D)${cod}(\\D|$)`).test(numeros) })
    ?? ativas.find((f) => f.remetente_email && t.includes(normalizar(f.remetente_email.split('@').pop()!.split('.')[0])) && normalizar(f.remetente_email.split('@').pop()!.split('.')[0]).length >= 4)
    ?? ativas.find((f) => emp && normalizar(f.nome).split(' ').some((p) => p.length >= 4 && emp.split(' ').includes(p)))
    ?? ativas.find((f) => normalizar(f.nome).split(' ').some((p) => p.length >= 5 && !/^(CONTA|FATURA|CASA|PLANO)$/.test(p) && new RegExp(`(^|\\s)${p}(\\s|$)`).test(t)))
}

/** Lê os campos de uma conta a partir do texto (função pura, testável). */
export function lerFaturaDeTexto(texto: string, opcoes: OpcoesLeitura = {}): LeituraExtraida {
  const bruto = String(texto || '')
  const t = bruto.replace(/ /g, ' ')
  const r: LeituraExtraida = { confianca: 0.3, origem_leitura: 'regex' }
  let pontos = 0

  // Valor: rótulo "total a pagar" / "valor a pagar" / "valor do documento" / "total" (valor pode vir na linha de baixo).
  const rotuloValor = /(?:TOTAL\s+A\s+PAGAR|VALOR\s+(?:TOTAL\s+)?A\s+PAGAR|VALOR\s+DO\s+DOCUMENTO|VALOR\s+TOTAL|VALOR\s+COBRADO|TOTAL\s+DA\s+FATURA|TOTAL\s+(?:DESTA\s+)?CONTA|VALOR\s+DA\s+CONTA|TOTAL)[^\d\n]{0,25}\n?[^\d\n]{0,15}(?:R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i
  const mv = t.match(rotuloValor)
  if (mv) { r.valor = lerValor(mv[1]); pontos += 2 }
  else {
    const valores = Array.from(t.matchAll(new RegExp(`(?:R\\$\\s*)?${RE_DINHEIRO.source}\\b`, 'g'))).map((m) => lerValor(m[1])).filter((v) => v > 0 && v < 100000)
    if (valores.length) r.valor = Math.max(...valores)
  }

  // Vencimento: rótulo seguido da data (pode estar na linha de baixo); senão a última data do texto.
  const datas = Array.from(t.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)).map((m) => m[1])
  const mvenc = t.match(/VENCIMENTO[^\d\n]{0,30}\n?[^\d\n]{0,15}(\d{2}\/\d{2}\/\d{4})/i) || t.match(/VENC\.?[^\d\n]{0,10}(\d{2}\/\d{2}\/\d{4})/i) || t.match(/PAGAR\s+AT[ÉE][^\d]{0,10}(\d{2}\/\d{2}\/\d{4})/i)
  if (mvenc && dataValida(dataIsoDeBr(mvenc[1]))) { r.vencimento = dataIsoDeBr(mvenc[1]); pontos += 2 }
  else if (datas.length) {
    const validas = datas.map(dataIsoDeBr).filter(dataValida)
    if (validas.length) r.vencimento = validas.sort()[validas.length - 1]
  }

  // Competência (mês de referência): "10/2026", "OUT/2026", "OUTUBRO/2026", "OUT 2026".
  const mref = t.match(/(?:REFER[ÊE]NCIA|M[ÊE]S\s+DE\s+REFER[ÊE]NCIA|M[ÊE]S\s+REF\.?|COMPET[ÊE]NCIA|M[ÊE]S\/ANO|PER[ÍI]ODO\s+DE\s+CONSUMO|CONTA\s+DO\s+M[ÊE]S)[^\dA-Za-z\n]{0,20}\n?[^\dA-Za-z\n]{0,10}(?:(\d{2})\/(\d{4})|([A-Za-zÇç]{3,9})\.?\s*[/\s-]\s*(\d{4}))/i)
  if (mref) {
    if (mref[1]) r.competencia = `${mref[2]}-${mref[1]}`
    else {
      const mes = MESES[normalizar(mref[3])]
      if (mes) r.competencia = `${mref[4]}-${mes}`
    }
    if (r.competencia) pontos += 1
  }
  if (!r.competencia) r.competencia = r.vencimento ? competenciaDe(r.vencimento) : opcoes.competenciaPadrao || competenciaDe()

  // Linha digitável: convênio (48 dígitos, "83640000003-1 12470138000-0 …") ou boleto bancário (47 dígitos).
  const candidatos = Array.from(t.matchAll(/(?:\d[\d.\s-]{44,70}\d)/g)).map((m) => m[0])
  for (const cand of candidatos) {
    const digitos = cand.replace(/\D/g, '')
    if (digitos.length === 47 || digitos.length === 48) { r.linha_digitavel = cand.replace(/[^\d]/g, ' ').replace(/\s+/g, ' ').trim(); pontos += 1; break }
  }
  if (!r.linha_digitavel) {
    const m48 = t.replace(/[\s.-]/g, '').match(/(8\d{47})/)
    if (m48) r.linha_digitavel = m48[1].replace(/(\d{11})(\d)/g, '$1 $2 ').trim()
  }

  // Pix copia e cola (BR Code começa com 000201).
  const pix = t.match(/(000201[0-9A-Za-z.\-*+:/\s]{40,})/)
  if (pix) r.pix_copia_cola = pix[1].replace(/\s+/g, '')

  // Consumo: "328 kWh", "kWh 328", "12 m³", "200 GB".
  const kwh = t.match(/(\d+(?:[.,]\d+)?)\s*kWh\b/i) || t.match(/kWh[^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i)
  const m3 = t.match(/(\d+(?:[.,]\d+)?)\s*m\s?[³3](?![A-Za-z0-9])/i) || t.match(/(?:^|\s)m[³3][^\d\n]{0,12}(\d+(?:[.,]\d+)?)/i)
  const gb = t.match(/(\d+(?:[.,]\d+)?)\s*GB\b/i)
  if (kwh) { r.consumo_valor = lerValor(kwh[1]); r.consumo_unidade = 'kWh' }
  else if (m3) { r.consumo_valor = lerValor(m3[1]); r.consumo_unidade = 'm³' }
  else if (gb) { r.consumo_valor = lerValor(gb[1]); r.consumo_unidade = 'GB' }

  // Empresa, conta fixa e categoria.
  const cnpj = t.match(/CNPJ\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i)
  if (cnpj) r.cnpj = cnpj[1]
  r.empresa = empresaDoTexto(t)
  if (r.empresa && EMPRESAS.some(([, n]) => n === r.empresa)) pontos += 1
  const casada = casarContaFixa(t, r.empresa, opcoes.contasFixas || [])
  if (casada) { r.conta_fixa_id = casada.id; r.categoria_id = casada.categoria_id; if (!r.empresa) r.empresa = casada.nome }
  else if (opcoes.categorias?.length) {
    const base = [r.empresa, r.consumo_unidade === 'kWh' ? 'ENERGIA' : r.consumo_unidade === 'm³' ? 'AGUA' : '', t.slice(0, 1500)].filter(Boolean).join(' ')
    const sug = sugerirCategoria(base, opcoes.categorias).find((id) => opcoes.categorias!.some((c) => c.id === id && c.fixa))
    if (sug) r.categoria_id = sug
  }

  r.confianca = Math.min(0.9, 0.3 + pontos * 0.1 + (r.valor && r.vencimento ? 0.1 : 0))
  return r
}

/** Junta a leitura feita no aparelho com a do servidor: o Claude (lê o documento inteiro) vence; OCR/regex do servidor só completa buracos. */
export function mesclarLeituras(local: LeituraExtraida | null, servidor: LeituraExtraida | null): LeituraExtraida {
  if (!local) return servidor ?? { confianca: 0, origem_leitura: 'regex' }
  if (!servidor) return local
  const [forte, fraca] = servidor.origem_leitura === 'claude' ? [servidor, local] : [local, servidor]
  const r: LeituraExtraida = { ...fraca, ...semVazios(forte), confianca: Math.max(local.confianca, servidor.confianca), origem_leitura: forte.origem_leitura }
  if (servidor.anexo_url) r.anexo_url = servidor.anexo_url
  return r
}

function semVazios<T extends object>(o: T): Partial<T> {
  const r: Partial<T> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') (r as Record<string, unknown>)[k] = v
  return r
}

/** Mensagem amigável quando o servidor não consegue ler fotos/PDFs escaneados. */
export function explicarErroDeLeitura(erro: unknown, ehPdf: boolean): string {
  const msg = erro instanceof Error ? erro.message : String(erro)
  if (/OCR|Drive n[aã]o ativado|CHAVE_API_CLAUDE|Claude/i.test(msg)) {
    return ehPdf
      ? 'Este PDF é só imagem (escaneado) e o servidor ainda não faz OCR. Preencha os campos à mão ou peça ao administrador para configurar a CHAVE_API_CLAUDE.'
      : 'O servidor ainda não lê fotos: falta a CHAVE_API_CLAUDE (ou o OCR do Drive). Envie o PDF da fatura, que é lido aqui no aparelho, ou preencha à mão.'
  }
  return msg || 'Não foi possível ler a fatura'
}
