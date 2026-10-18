/**
 * Construtor heráldico clássico: gera o brasão da família como SVG 512×512,
 * tudo em traço dourado sobre azul-noite (mesma linguagem do `BrasaoPadrao`).
 * Função pura, sem DOM — serve ao app, aos testes e à geração dos ícones.
 */

export type FormatoEscudo = 'classico' | 'iberico' | 'suico'
export type Particao = 'pleno' | 'partido' | 'cortado' | 'esquartelado' | 'chevron'
export type Movel = 'nenhum' | 'cruz' | 'ancora' | 'livro' | 'araucaria' | 'leao' | 'oliveira'
export type Fundo = 'circulo' | 'quadrado'

export interface OpcoesBrasao {
  escudo: FormatoEscudo
  /** Esmalte principal do campo (hex). */
  esmalte1: string
  /** Segundo esmalte, usado pela partição (hex). */
  esmalte2: string
  particao: Particao
  movel: Movel
  /** 0 a 3 letras. */
  iniciais: string
  /** Mote do listel. Vazio = sem listel. */
  mote: string
  /** Ano de fundação opcional (ex.: "2012"). */
  ano: string
  fundo: Fundo
  /** Espessura do traço em unidades do SVG de 512 (4 = fino, 6 = médio, 8 = forte). */
  traco: number
}

export const OURO = '#F2C552'
export const AZUL_NOITE = '#0D0E23'

/** Paleta heráldica discreta (os "esmaltes"). O ouro é sempre o traço. */
export const ESMALTES: Array<{ nome: string; hex: string }> = [
  { nome: 'Azul-noite', hex: '#0D0E23' },
  { nome: 'Azul', hex: '#1F2050' },
  { nome: 'Índigo', hex: '#2E2F6E' },
  { nome: 'Verde-escuro', hex: '#143A2B' },
  { nome: 'Vinho', hex: '#4A1B2A' },
  { nome: 'Cinza-ardósia', hex: '#363848' },
]

export const FORMATOS: Array<{ id: FormatoEscudo; nome: string }> = [
  { id: 'classico', nome: 'Clássico' },
  { id: 'iberico', nome: 'Ibérico' },
  { id: 'suico', nome: 'Suíço' },
]
export const PARTICOES: Array<{ id: Particao; nome: string }> = [
  { id: 'pleno', nome: 'Pleno' },
  { id: 'partido', nome: 'Partido' },
  { id: 'cortado', nome: 'Cortado' },
  { id: 'esquartelado', nome: 'Esquartelado' },
  { id: 'chevron', nome: 'Chevron' },
]
export const MOVEIS: Array<{ id: Movel; nome: string }> = [
  { id: 'nenhum', nome: 'Nenhum' },
  { id: 'cruz', nome: 'Cruz' },
  { id: 'ancora', nome: 'Âncora' },
  { id: 'livro', nome: 'Livro aberto' },
  { id: 'araucaria', nome: 'Araucária' },
  { id: 'leao', nome: 'Leão' },
  { id: 'oliveira', nome: 'Ramo de oliveira' },
]
export const MOTES = ['Josué 24.15', 'Soli Deo Gloria', 'Eu e a minha casa serviremos ao Senhor', 'Fides et Labor']

export const OPCOES_PADRAO: OpcoesBrasao = {
  escudo: 'classico',
  esmalte1: '#1F2050',
  esmalte2: '#0D0E23',
  particao: 'pleno',
  movel: 'cruz',
  iniciais: '',
  mote: 'Josué 24.15',
  ano: '',
  fundo: 'circulo',
  traco: 6,
}

export function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Escudo: caixa 146..366 × ~96..356 no SVG de 512.
const ESCUDOS: Record<FormatoEscudo, string> = {
  classico: 'M146 100H366V236C366 296 318 334 256 352C194 334 146 296 146 236Z',
  iberico: 'M146 100H366V246A110 110 0 0 1 146 246Z',
  suico: 'M146 112C182 98 220 94 256 94C292 94 330 98 366 112V236C366 296 318 334 256 352C194 334 146 296 146 236Z',
}

const SERIFA = "Georgia, 'Times New Roman', Times, serif"

/** Folha estilizada: duas curvas fechadas, apontando no ângulo dado (graus), a partir de (x, y). */
function folha(x: number, y: number, angulo: number, comprimento = 16, largura = 6): string {
  const a = (angulo * Math.PI) / 180
  const ux = Math.cos(a), uy = Math.sin(a) // eixo da folha
  const vx = -uy, vy = ux // perpendicular
  const p = (t: number, w: number) => `${(x + ux * comprimento * t + vx * w).toFixed(1)} ${(y + uy * comprimento * t + vy * w).toFixed(1)}`
  return `M${p(0, 0)}C${p(0.3, largura)} ${p(0.7, largura)} ${p(1, 0)}C${p(0.7, -largura)} ${p(0.3, -largura)} ${p(0, 0)}Z`
}

/** Paths de cada móvel numa caixa de 100×100 (só traço; sem preenchimentos chapados). */
export function pathsMovel(movel: Movel): string[] {
  switch (movel) {
    case 'cruz':
      return ['M41 8H59V36H88V54H59V92H41V54H12V36H41Z', 'M50 22V78', 'M26 45H74']
    case 'ancora':
      return ['M50 6A7 7 0 1 0 50.01 6', 'M50 20V88', 'M30 32H70', 'M50 88C32 88 18 74 14 56', 'M14 56L7 62', 'M14 56L22 59', 'M50 88C68 88 82 74 86 56', 'M86 56L93 62', 'M86 56L78 59']
    case 'livro':
      return [
        'M50 28C38 20 24 20 12 24V78C24 74 38 74 50 82C62 74 76 74 88 78V24C76 20 62 20 50 28Z', 'M50 28V82',
        'M22 38C30 36 38 37 44 40', 'M22 50C30 48 38 49 44 52', 'M22 62C30 60 38 61 44 64',
        'M56 40C62 37 70 36 78 38', 'M56 52C62 49 70 48 78 50', 'M56 64C62 61 70 60 78 62',
      ]
    case 'araucaria':
      // Pinheiro-do-paraná: tronco alto e copa em taça (candelabro), com tufos nas pontas.
      return [
        'M50 94V44', 'M38 94H62',
        'M50 44C40 44 26 40 14 26', 'M50 44C60 44 74 40 86 26',
        'M50 44C44 38 36 30 30 16', 'M50 44C56 38 64 30 70 16',
        'M50 44V12',
        'M9 30L14 26L19 29', 'M81 29L86 26L91 30', 'M25 19L30 16L35 18', 'M65 18L70 16L75 19', 'M45 15L50 12L55 15',
      ]
    case 'leao':
      // Leão rampante simplificado: contorno único, voltado para a destra (esquerda de quem vê), cauda erguida.
      return [
        'M18 30C16 26 19 22 24 22L28 14L32 8L36 14C44 10 54 14 56 24C58 34 60 44 62 52C66 58 70 64 70 72L74 90L76 92H64L62 84L60 76C56 74 52 72 50 70L46 80V92H34L36 84L40 74C38 66 36 60 38 54L22 50L14 52L14 46L24 44L36 46L30 40L14 32L10 26L16 26L28 32L28 36L24 38L18 36L22 32Z',
        'M70 72C80 66 86 56 82 46C80 40 74 42 76 48', 'M82 46L86 40M82 46L88 46',
        'M34 20A1.6 1.6 0 1 0 34.01 20', 'M44 18C40 26 42 34 48 40',
      ]
    case 'oliveira': {
      const tronco = 'M26 90C40 66 56 42 78 12'
      const pontos: Array<[number, number, number]> = [[36, 72, 150], [36, 72, 60], [48, 54, 150], [48, 54, 60], [61, 36, 150], [61, 36, 60], [72, 22, 150]]
      const folhas = pontos.map(([x, y, ang]) => folha(x, y, ang, 20, 7))
      const azeitonas = ['M41 63A3 3 0 1 0 41.01 63', 'M58 45A3 3 0 1 0 58.01 45']
      return [tronco, ...folhas, ...azeitonas]
    }
    default:
      return []
  }
}

/** Regiões do segundo esmalte conforme a partição (dentro do recorte do escudo). */
function regioesEsmalte2(particao: Particao): string[] {
  switch (particao) {
    case 'partido': return ['M256 80H380V370H256Z']
    case 'cortado': return ['M130 224H380V370H130Z']
    case 'esquartelado': return ['M256 80H380V224H256Z', 'M130 224H256V370H130Z']
    case 'chevron': return ['M130 318L256 196L382 318V370H130Z']
    default: return []
  }
}

/** Linhas douradas da partição. */
function linhasParticao(particao: Particao): string[] {
  switch (particao) {
    case 'partido': return ['M256 96V356']
    case 'cortado': return ['M140 224H372']
    case 'esquartelado': return ['M256 96V356', 'M140 224H372']
    case 'chevron': return ['M140 318L256 196L372 318']
    default: return []
  }
}

function tamanhoMote(mote: string): number {
  const largura = 236 // largura útil do listel
  return Math.max(9, Math.min(15, largura / (mote.length * 0.58)))
}

/** Gera o SVG completo (string) do brasão. */
export function gerarBrasaoSvg(parcial: Partial<OpcoesBrasao> = {}): string {
  const o: OpcoesBrasao = { ...OPCOES_PADRAO, ...parcial }
  const iniciais = (o.iniciais || '').trim().slice(0, 3).toUpperCase()
  const mote = (o.mote || '').trim()
  const ano = (o.ano || '').trim().slice(0, 12)
  const traco = Math.max(2, Math.min(12, Number(o.traco) || 6))
  const fino = (traco * 0.7).toFixed(2)
  const partes: string[] = []

  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Brasão da família">`)
  partes.push('<defs>')
  partes.push(`<clipPath id="escudo"><path d="${ESCUDOS[o.escudo]}"/></clipPath>`)
  partes.push('</defs>')

  // Fundo
  if (o.fundo === 'circulo') partes.push(`<circle cx="256" cy="256" r="256" fill="${escapar(AZUL_NOITE)}"/>`)
  else partes.push(`<rect width="512" height="512" rx="112" fill="${escapar(AZUL_NOITE)}"/>`)

  // Campo do escudo com os esmaltes
  partes.push(`<g clip-path="url(#escudo)">`)
  partes.push(`<rect x="120" y="80" width="272" height="300" fill="${escapar(o.esmalte1)}"/>`)
  for (const r of regioesEsmalte2(o.particao)) partes.push(`<path d="${r}" fill="${escapar(o.esmalte2)}"/>`)
  partes.push('</g>')

  // Traços dourados: contorno, partição, móvel, iniciais
  partes.push(`<g fill="none" stroke="${OURO}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round">`)
  partes.push(`<path d="${ESCUDOS[o.escudo]}"/>`)
  const linhas = linhasParticao(o.particao)
  if (linhas.length) partes.push(`<g clip-path="url(#escudo)">${linhas.map((l) => `<path d="${l}" stroke-width="${fino}"/>`).join('')}</g>`)

  const paths = pathsMovel(o.movel)
  if (paths.length) {
    // Com iniciais no chefe, o móvel desce um pouco e fica menor.
    const escala = iniciais ? 1.3 : 1.6
    const x = 256 - 50 * escala
    const y = iniciais ? 162 : 136
    partes.push(`<g transform="translate(${x.toFixed(1)} ${y}) scale(${escala})" stroke-width="${(traco / escala).toFixed(2)}">`)
    for (const p of paths) partes.push(`<path d="${p}"/>`)
    partes.push('</g>')
  }
  partes.push('</g>')

  if (iniciais) {
    const tamanho = paths.length ? 40 : 84
    const y = paths.length ? 148 : 254
    partes.push(`<text x="256" y="${y}" text-anchor="middle" font-family="${SERIFA}" font-size="${tamanho}" font-weight="500" letter-spacing="${paths.length ? 4 : 8}" fill="${OURO}">${escapar(iniciais)}</text>`)
  }

  // Listel com o mote
  if (mote) {
    partes.push(`<path d="M124 386H388L372 404L388 422H124L140 404Z" fill="${escapar(AZUL_NOITE)}" stroke="${OURO}" stroke-width="${fino}" stroke-linejoin="round"/>`)
    partes.push(`<text x="256" y="409" text-anchor="middle" font-family="${SERIFA}" font-size="${tamanhoMote(mote).toFixed(1)}" letter-spacing="1" fill="${OURO}">${escapar(mote)}</text>`)
  }
  if (ano) {
    const y = mote ? 452 : 412
    partes.push(`<text x="256" y="${y}" text-anchor="middle" font-family="${SERIFA}" font-size="15" letter-spacing="3" fill="${OURO}">${escapar(ano)}</text>`)
  }

  partes.push('</svg>')
  return partes.join('')
}

/** `data:` URL do SVG, para usar em `<img src>`. */
export function svgParaDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
