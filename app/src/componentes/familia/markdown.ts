/**
 * Mini-conversor de markdown (sem biblioteca) para a pauta da reunião.
 * Entende: `#`/`##`/`###` títulos, `-` listas, `>` citação, `**negrito**`,
 * `_itálico_` e parágrafos. O resultado é uma estrutura simples que o
 * componente `Markdown.tsx` desenha.
 */

export interface Trecho {
  tipo: 'texto' | 'negrito' | 'italico'
  texto: string
}

export interface Bloco {
  tipo: 'h1' | 'h2' | 'h3' | 'item' | 'citacao' | 'paragrafo'
  trechos: Trecho[]
}

export interface Secao {
  titulo: string
  blocos: Bloco[]
}

/** Divide uma linha em trechos normais, negrito e itálico. */
export function analisarInline(texto: string): Trecho[] {
  const trechos: Trecho[] = []
  const re = /\*\*([^*]+)\*\*|_([^_]+)_/g
  let ultimo = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) trechos.push({ tipo: 'texto', texto: texto.slice(ultimo, m.index) })
    if (m[1] !== undefined) trechos.push({ tipo: 'negrito', texto: m[1] })
    else trechos.push({ tipo: 'italico', texto: m[2] })
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) trechos.push({ tipo: 'texto', texto: texto.slice(ultimo) })
  return trechos
}

/** Converte o markdown em blocos (uma passada, linha a linha). */
export function analisarMarkdown(md: string): Bloco[] {
  const blocos: Bloco[] = []
  let paragrafo: string[] = []
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', trechos: analisarInline(paragrafo.join(' ')) })
    paragrafo = []
  }
  for (const bruta of (md || '').split(/\r?\n/)) {
    const linha = bruta.trimEnd()
    if (!linha.trim()) {
      fecharParagrafo()
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = linha.match(/^(#{1,3})\s+(.*)$/))) {
      fecharParagrafo()
      const nivel = m[1].length
      blocos.push({ tipo: nivel === 1 ? 'h1' : nivel === 2 ? 'h2' : 'h3', trechos: analisarInline(m[2].trim()) })
    } else if ((m = linha.match(/^\s*[-*]\s+(.*)$/))) {
      fecharParagrafo()
      blocos.push({ tipo: 'item', trechos: analisarInline(m[1]) })
    } else if ((m = linha.match(/^>\s?(.*)$/))) {
      fecharParagrafo()
      blocos.push({ tipo: 'citacao', trechos: analisarInline(m[1]) })
    } else {
      paragrafo.push(linha.trim())
    }
  }
  fecharParagrafo()
  return blocos
}

/** Agrupa por `##`: título geral (do `#`) + uma seção por `##`. */
export function dividirSecoes(md: string): { titulo: string; secoes: Secao[] } {
  const blocos = analisarMarkdown(md)
  let titulo = ''
  const secoes: Secao[] = []
  let atual: Secao | null = null
  for (const b of blocos) {
    if (b.tipo === 'h1' && !titulo) {
      titulo = textoDe(b.trechos)
      continue
    }
    if (b.tipo === 'h2') {
      atual = { titulo: textoDe(b.trechos), blocos: [] }
      secoes.push(atual)
      continue
    }
    if (!atual) {
      atual = { titulo: '', blocos: [] }
      secoes.push(atual)
    }
    atual.blocos.push(b)
  }
  return { titulo, secoes }
}

/** Texto puro (para compartilhar pelo WhatsApp etc.). */
export function markdownParaTexto(md: string): string {
  const linhas: string[] = []
  for (const b of analisarMarkdown(md)) {
    const t = textoDe(b.trechos)
    if (b.tipo === 'h1') linhas.push(t.toUpperCase(), '')
    else if (b.tipo === 'h2' || b.tipo === 'h3') linhas.push('', t)
    else if (b.tipo === 'item') linhas.push(`• ${t}`)
    else if (b.tipo === 'citacao') linhas.push(`“${t}”`)
    else linhas.push(t)
  }
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function textoDe(trechos: Trecho[]): string {
  return trechos.map((t) => t.texto).join('')
}

/** Ícone da seção da pauta pelo número que abre o título ("3. Contas que subiram" → 📊). */
export function iconeDaSecao(titulo: string): string {
  const icones: Record<string, string> = { '1': '📈', '2': '⚠️', '3': '📊', '4': '✈️', '5': '🗳️', '6': '📖', '7': '✍️', '8': '🙏' }
  const m = titulo.match(/^(\d+)\./)
  return (m && icones[m[1]]) || '📝'
}

/** "16053.01" → "16.053,01" (números com duas casas decimais, como a pauta gerada devolve). */
export function formatarNumerosBr(texto: string): string {
  return texto.replace(/(?<![\d.,])(\d{1,12})\.(\d{2})(?![\d.])/g, (_m, inteiro: string, dec: string) => `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`)
}
