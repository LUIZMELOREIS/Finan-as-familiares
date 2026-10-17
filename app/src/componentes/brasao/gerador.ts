/**
 * Gerador do brasão da família em SVG (função pura, sem React).
 * Tudo é desenhado em um quadro de 512×512: escudo (3 formatos), duas cores,
 * divisão heráldica, símbolo central dourado, iniciais, faixa com o mote e ano.
 */

export type FormatoEscudo = 'classico' | 'frances' | 'redondo'
export type DivisaoEscudo = 'liso' | 'partido' | 'cortado' | 'esquartelado'
export type SimboloBrasao = 'nenhum' | 'cruz' | 'ancora' | 'pomba' | 'leao' | 'livro' | 'araucaria' | 'coroa' | 'oliveira' | 'trigo'

export interface OpcoesBrasao {
  formato: FormatoEscudo
  cor1: string
  cor2: string
  divisao: DivisaoEscudo
  simbolo: SimboloBrasao
  iniciais: string
  mote: string
  ano: string
}

export const DOURADO = '#F2C552'
const DOURADO_ESCURO = '#B8892E'

export const OPCOES_PADRAO: OpcoesBrasao = {
  formato: 'classico',
  cor1: '#5B5BE0',
  cor2: '#0D0E23',
  divisao: 'partido',
  simbolo: 'cruz',
  iniciais: 'MR',
  mote: 'Js 24:15',
  ano: '',
}

export const FORMATOS: Array<{ id: FormatoEscudo; nome: string }> = [
  { id: 'classico', nome: 'Clássico' },
  { id: 'frances', nome: 'Francês' },
  { id: 'redondo', nome: 'Redondo' },
]
export const DIVISOES: Array<{ id: DivisaoEscudo; nome: string; dica: string }> = [
  { id: 'liso', nome: 'Liso', dica: 'uma cor só' },
  { id: 'partido', nome: 'Partido', dica: 'dividido na vertical' },
  { id: 'cortado', nome: 'Cortado', dica: 'dividido na horizontal' },
  { id: 'esquartelado', nome: 'Esquartelado', dica: '4 partes' },
]
export const SIMBOLOS: Array<{ id: SimboloBrasao; nome: string; significado: string }> = [
  { id: 'cruz', nome: 'Cruz', significado: 'fé em Cristo' },
  { id: 'ancora', nome: 'Âncora', significado: 'esperança firme (Hb 6:19)' },
  { id: 'pomba', nome: 'Pomba', significado: 'paz e Espírito Santo' },
  { id: 'leao', nome: 'Leão', significado: 'coragem (Leão de Judá)' },
  { id: 'livro', nome: 'Livro aberto', significado: 'a Palavra' },
  { id: 'araucaria', nome: 'Araucária', significado: 'raízes no Paraná' },
  { id: 'coroa', nome: 'Coroa', significado: 'Cristo é Rei' },
  { id: 'oliveira', nome: 'Ramo de oliveira', significado: 'paz e provisão' },
  { id: 'trigo', nome: 'Ramo de trigo', significado: 'pão de cada dia' },
  { id: 'nenhum', nome: 'Só as iniciais', significado: '' },
]
export const MOTES_RAPIDOS = ['Js 24:15', 'Soli Deo Gloria', 'Eu e a minha casa serviremos ao Senhor', 'Fé, Família e Trabalho']

/** Escapa texto para dentro de XML. */
export function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Caminho do escudo (área 96..416 na horizontal, 56..400 na vertical). */
function caminhoEscudo(formato: FormatoEscudo): string {
  switch (formato) {
    case 'frances':
      // Escudo francês moderno: lados retos, base com "orelhas" e ponta.
      return 'M96 56 H416 V300 Q416 352 384 368 Q320 380 300 400 Q280 388 256 404 Q232 388 212 400 Q192 380 128 368 Q96 352 96 300 Z'
    case 'redondo':
      return 'M256 48 A168 168 0 1 1 255.9 48 Z'
    case 'classico':
    default:
      // Escudo clássico (heater): topo reto, laterais caindo em ponta.
      return 'M96 56 H416 V232 C416 330 340 384 256 408 C172 384 96 330 96 232 Z'
  }
}

/** Símbolos em um quadro de 100×100 (centro 50,50), preenchidos em dourado. */
function simbolo(id: SimboloBrasao): string {
  const f = `fill="${DOURADO}"`
  const s = `fill="none" stroke="${DOURADO}" stroke-linecap="round" stroke-linejoin="round"`
  switch (id) {
    case 'cruz':
      return `<path ${f} d="M41 6h18v29h30v18H59v41H41V53H11V35h30z"/>`
    case 'ancora':
      return [
        `<circle cx="50" cy="14" r="8" ${s} stroke-width="6"/>`,
        `<path ${s} stroke-width="8" d="M50 22v68"/>`,
        `<path ${s} stroke-width="7" d="M30 40h40"/>`,
        `<path ${s} stroke-width="8" d="M14 62c4 20 20 30 36 30s32-10 36-30"/>`,
        `<path ${f} d="M8 54l12 4-4 12zM92 54l-12 4 4 12z"/>`,
      ].join('')
    case 'pomba':
      return [
        // Pomba em voo para a direita: corpo, cabeça com bico, asa levantada e cauda em leque.
        `<path ${f} d="M14 66C20 50 38 42 56 44c4-8 10-12 18-12 6 0 10 4 10 8l10 2-10 3c-2 7-8 11-14 11 0 10-8 18-20 20-10 2-20 0-30-4L6 80l8-12L2 62h12z"/>`,
        `<path ${f} d="M44 48c-4-14 2-30 16-40-2 14 0 26 6 36z"/>`,
        `<path ${f} d="M38 58c-10 2-18-2-24-8 10 0 18 2 26 4z"/>`,
        `<circle cx="76" cy="38" r="2.4" fill="${DOURADO_ESCURO}"/>`,
      ].join('')
    case 'leao': {
      // Cabeça de leão de frente: juba em estrela, rosto, orelhas, olhos e focinho.
      const pontos: string[] = []
      for (let i = 0; i < 32; i++) {
        const r = i % 2 === 0 ? 44 : 35
        const a = (i / 32) * Math.PI * 2 - Math.PI / 2
        pontos.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`)
      }
      return [
        `<polygon points="${pontos.join(' ')}" ${f}/>`,
        `<circle cx="34" cy="26" r="7" fill="${DOURADO_ESCURO}"/><circle cx="66" cy="26" r="7" fill="${DOURADO_ESCURO}"/>`,
        `<circle cx="50" cy="52" r="25" fill="${DOURADO_ESCURO}"/>`,
        `<circle cx="50" cy="52" r="21" ${f}/>`,
        `<circle cx="41" cy="46" r="3" fill="#2A1E05"/><circle cx="59" cy="46" r="3" fill="#2A1E05"/>`,
        `<path fill="#2A1E05" d="M44 56h12l-6 7z"/>`,
        `<path fill="none" stroke="#2A1E05" stroke-width="2.5" stroke-linecap="round" d="M50 63v4M50 67c-3 4-8 4-11 1M50 67c3 4 8 4 11 1"/>`,
      ].join('')
    }
    case 'araucaria': {
      // Araucária: tronco alto e copa em candelabro (galhos que sobem nas pontas).
      const galhos: string[] = []
      const tiers = [[52, 38], [42, 30], [32, 22], [22, 13]]
      for (const [y, w] of tiers) {
        galhos.push(`<path ${s} stroke-width="5" d="M50 ${y}C${50 - w * 0.55} ${y + 3} ${50 - w * 0.85} ${y - 2} ${50 - w} ${y - 12}"/>`)
        galhos.push(`<path ${s} stroke-width="5" d="M50 ${y}C${50 + w * 0.55} ${y + 3} ${50 + w * 0.85} ${y - 2} ${50 + w} ${y - 12}"/>`)
        galhos.push(`<circle cx="${50 - w}" cy="${y - 13}" r="4" ${f}/><circle cx="${50 + w}" cy="${y - 13}" r="4" ${f}/>`)
      }
      return [
        `<path ${f} d="M47 40h6v52h-6z"/>`,
        ...galhos,
        `<path ${f} d="M50 4l8 12H42z"/>`,
        `<path ${f} d="M24 94c8-5 18-7 26-7s18 2 26 7z"/>`,
      ].join('')
    }
    case 'livro':
      return [
        `<path ${f} d="M8 22c14-6 28-6 40 2v60c-12-8-26-8-40-2zM92 22c-14-6-28-6-40 2v60c12-8 26-8 40-2z"/>`,
        `<path ${s} stroke-width="4" d="M16 34c8-2 16-2 24 2M16 46c8-2 16-2 24 2M16 58c8-2 16-2 24 2M60 36c8-4 16-4 24-2M60 48c8-4 16-4 24-2M60 60c8-4 16-4 24-2"/>`,
        `<path ${f} d="M48 24h4v62h-4z"/>`,
      ].join('')
    case 'coroa':
      return [
        `<path ${f} d="M12 36l16 20 22-30 22 30 16-20-6 44H18z"/>`,
        `<path ${f} d="M18 84h64v8H18z"/>`,
        `<circle cx="12" cy="34" r="5" ${f}/><circle cx="50" cy="24" r="5" ${f}/><circle cx="88" cy="34" r="5" ${f}/>`,
        `<circle cx="34" cy="72" r="3.5" fill="${DOURADO_ESCURO}"/><circle cx="50" cy="72" r="3.5" fill="${DOURADO_ESCURO}"/><circle cx="66" cy="72" r="3.5" fill="${DOURADO_ESCURO}"/>`,
      ].join('')
    case 'oliveira':
      return [
        `<path ${s} stroke-width="5" d="M20 86C36 62 50 40 80 14"/>`,
        `<ellipse cx="34" cy="60" rx="12" ry="5" transform="rotate(-55 34 60)" ${f}/>`,
        `<ellipse cx="50" cy="42" rx="12" ry="5" transform="rotate(-55 50 42)" ${f}/>`,
        `<ellipse cx="66" cy="26" rx="11" ry="4.5" transform="rotate(-55 66 26)" ${f}/>`,
        `<ellipse cx="46" cy="66" rx="12" ry="5" transform="rotate(20 46 66)" ${f}/>`,
        `<ellipse cx="62" cy="48" rx="12" ry="5" transform="rotate(20 62 48)" ${f}/>`,
        `<ellipse cx="78" cy="32" rx="10" ry="4.5" transform="rotate(20 78 32)" ${f}/>`,
        `<circle cx="26" cy="74" r="5" fill="${DOURADO_ESCURO}"/><circle cx="40" cy="52" r="5" fill="${DOURADO_ESCURO}"/>`,
      ].join('')
    case 'trigo': {
      const graos: string[] = []
      for (let i = 0; i < 6; i++) {
        const y = 20 + i * 9
        graos.push(`<ellipse cx="42" cy="${y}" rx="5" ry="9" transform="rotate(25 42 ${y})" ${f}/>`)
        graos.push(`<ellipse cx="58" cy="${y}" rx="5" ry="9" transform="rotate(-25 58 ${y})" ${f}/>`)
      }
      return [`<path ${s} stroke-width="5" d="M50 94V12"/>`, `<path ${s} stroke-width="3" d="M50 12l-6-8M50 12l6-8"/>`, ...graos].join('')
    }
    case 'nenhum':
    default:
      return ''
  }
}

/** Gera o SVG completo do brasão (string). */
export function gerarBrasaoSvg(o: OpcoesBrasao): string {
  const escudo = caminhoEscudo(o.formato)
  const iniciais = escaparXml(o.iniciais.trim().slice(0, 3).toUpperCase())
  const mote = escaparXml(o.mote.trim())
  const ano = escaparXml(o.ano.trim())
  const temSimbolo = o.simbolo !== 'nenhum'

  // Divisão do campo (a área do escudo vai de 96..416 × 48..416; o clip corta o que sobra).
  let divisao = ''
  if (o.divisao === 'partido') divisao = `<rect x="256" y="40" width="170" height="380" fill="${o.cor2}"/>`
  else if (o.divisao === 'cortado') divisao = `<rect x="80" y="232" width="360" height="190" fill="${o.cor2}"/>`
  else if (o.divisao === 'esquartelado') divisao = `<rect x="256" y="40" width="170" height="192" fill="${o.cor2}"/><rect x="80" y="232" width="176" height="190" fill="${o.cor2}"/>`

  // Posição do símbolo e das iniciais.
  const escalaSimbolo = iniciais ? 1.7 : 2.3
  const ySimbolo = iniciais ? 112 : 128
  const xSimbolo = 256 - 50 * escalaSimbolo
  const yIniciais = temSimbolo ? 338 : 258
  const tamIniciais = temSimbolo ? (iniciais.length > 2 ? 64 : 76) : iniciais.length > 2 ? 120 : 150
  const grupoSimbolo = temSimbolo ? `<g transform="translate(${xSimbolo} ${ySimbolo}) scale(${escalaSimbolo})">${simbolo(o.simbolo)}</g>` : ''
  const textoIniciais = iniciais
    ? `<text x="256" y="${yIniciais}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${tamIniciais}" fill="${DOURADO}" stroke="${DOURADO_ESCURO}" stroke-width="1.5" letter-spacing="4">${iniciais}</text>`
    : ''

  // Faixa inferior (mote) — mais longa quando o texto é longo.
  const larguraFaixa = Math.min(440, Math.max(240, mote.length * 13 + 60))
  const xf = 256 - larguraFaixa / 2
  const tamMote = mote.length > 30 ? 16 : mote.length > 18 ? 20 : 26
  const faixa = mote
    ? [
        `<path d="M${xf} 428 l-18 18 18 18 h${larguraFaixa} l18-18-18-18 z" fill="${DOURADO_ESCURO}"/>`,
        `<rect x="${xf}" y="420" width="${larguraFaixa}" height="48" rx="6" fill="${DOURADO}"/>`,
        `<text x="256" y="446" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="${tamMote}" fill="#2A1E05">${mote}</text>`,
      ].join('')
    : ''
  const textoAno = ano ? `<text x="256" y="496" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" letter-spacing="6" fill="${DOURADO}">${ano}</text>` : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Brasão da família ${iniciais}">`,
    `<defs><clipPath id="escudo"><path d="${escudo}"/></clipPath></defs>`,
    `<g clip-path="url(#escudo)">`,
    `<rect x="0" y="0" width="512" height="512" fill="${o.cor1}"/>`,
    divisao,
    `</g>`,
    `<path d="${escudo}" fill="none" stroke="${DOURADO}" stroke-width="10" stroke-linejoin="round"/>`,
    `<path d="${escudo}" fill="none" stroke="${DOURADO_ESCURO}" stroke-width="3" stroke-linejoin="round" transform="translate(0 0)"/>`,
    grupoSimbolo,
    textoIniciais,
    faixa,
    textoAno,
    `</svg>`,
  ].join('')
}

/** Data URL do SVG, para usar em <img src>. */
export function svgParaDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
