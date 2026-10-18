/**
 * Mini-conversor de markdown para a pauta da reunião (gerada pela API):
 * `#`/`##` títulos, `-` itens, `>` citações, `**negrito**` e `_itálico_`.
 * Devolve uma estrutura simples que a tela renderiza em cards por seção.
 */

export interface Trecho { texto: string; negrito?: boolean; italico?: boolean }
export type TipoBloco = 'paragrafo' | 'item' | 'citacao'
export interface Bloco { tipo: TipoBloco; trechos: Trecho[] }
export interface Secao {
  nivel: 1 | 2
  titulo: string
  /** Número da seção quando o título começa com "3. " */
  numero?: number
  blocos: Bloco[]
}

/** Converte `**negrito**` e `_itálico_` em trechos. */
export function converterInline(texto: string): Trecho[] {
  const trechos: Trecho[] = []
  const re = /\*\*(.+?)\*\*|(?<![\wÀ-ÿ])_(.+?)_(?![\wÀ-ÿ])/g
  let ultimo = 0
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0
    if (i > ultimo) trechos.push({ texto: texto.slice(ultimo, i) })
    if (m[1] !== undefined) trechos.push({ texto: m[1], negrito: true })
    else trechos.push({ texto: m[2], italico: true })
    ultimo = i + m[0].length
  }
  if (ultimo < texto.length) trechos.push({ texto: texto.slice(ultimo) })
  return trechos.length ? trechos : [{ texto: '' }]
}

/** Separa o markdown em seções (`#`, `##`) com seus blocos. Texto antes do primeiro título vira seção sem título. */
export function converterMarkdown(md: string): Secao[] {
  const secoes: Secao[] = []
  let atual: Secao | null = null
  const garantir = () => {
    if (!atual) { atual = { nivel: 1, titulo: '', blocos: [] }; secoes.push(atual) }
    return atual
  }
  for (const linhaBruta of md.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = linhaBruta.trimEnd()
    if (!linha.trim()) continue
    const titulo = linha.match(/^(#{1,2})\s+(.*)$/)
    if (titulo) {
      const texto = titulo[2].trim()
      const num = texto.match(/^(\d+)\.\s+(.*)$/)
      atual = { nivel: titulo[1].length as 1 | 2, titulo: num ? num[2] : texto, numero: num ? Number(num[1]) : undefined, blocos: [] }
      secoes.push(atual)
      continue
    }
    const sec = garantir()
    const item = linha.match(/^\s*[-*]\s+(.*)$/)
    if (item) { sec.blocos.push({ tipo: 'item', trechos: converterInline(item[1]) }); continue }
    const citacao = linha.match(/^\s*>\s?(.*)$/)
    if (citacao) { sec.blocos.push({ tipo: 'citacao', trechos: converterInline(citacao[1]) }); continue }
    sec.blocos.push({ tipo: 'paragrafo', trechos: converterInline(linha.trim()) })
  }
  return secoes
}

/** Texto puro de uma seção (para compartilhar/copiar). */
export function textoDaSecao(s: Secao): string {
  return s.blocos.map((b) => (b.tipo === 'item' ? '• ' : b.tipo === 'citacao' ? '“' : '') + b.trechos.map((t) => t.texto).join('') + (b.tipo === 'citacao' ? '”' : '')).join('\n')
}

/** Uma seção está vazia quando só tem o marcador "(preencher)" ou nada. */
export function secaoVazia(s: Secao): boolean {
  const t = textoDaSecao(s).trim()
  return !t || /^\(?preencher\)?$/i.test(t.replace(/[_*]/g, '').trim())
}

/** Markdown → texto simples para `navigator.share` / área de transferência. */
export function markdownParaTexto(md: string): string {
  return converterMarkdown(md).map((s) => (s.titulo ? `${s.numero ? `${s.numero}. ` : ''}${s.titulo.toUpperCase()}\n` : '') + textoDaSecao(s)).join('\n\n')
}
