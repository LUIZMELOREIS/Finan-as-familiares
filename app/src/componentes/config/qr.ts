/**
 * Gerador mínimo de QR Code (ISO/IEC 18004), feito em casa para o convite
 * da família não depender de nenhum serviço externo.
 *  - versões 1 a 10 (até 213 bytes), nível de correção M, modo byte (UTF-8);
 *  - escolha automática da máscara pela pontuação de penalidade.
 */

export interface MatrizQr {
  versao: number
  tamanho: number
  /** modulos[linha][coluna] — true = módulo escuro */
  modulos: boolean[][]
}

// Blocos de correção de erro (nível M), versões 1..10: [quantidade de blocos, bytes de dados por bloco]
const BLOCOS_M: Array<{ ec: number; blocos: Array<[number, number]> }> = [
  { ec: 10, blocos: [[1, 16]] },
  { ec: 16, blocos: [[1, 28]] },
  { ec: 26, blocos: [[1, 44]] },
  { ec: 18, blocos: [[2, 32]] },
  { ec: 24, blocos: [[2, 43]] },
  { ec: 16, blocos: [[4, 27]] },
  { ec: 18, blocos: [[4, 31]] },
  { ec: 22, blocos: [[2, 38], [2, 39]] },
  { ec: 22, blocos: [[3, 36], [2, 37]] },
  { ec: 26, blocos: [[4, 43], [1, 44]] },
]
const ALINHAMENTO = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

// ---------- Corpo de Galois GF(256), polinômio 0x11D ----------
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0)

function polinomioGerador(grau: number): number[] {
  let g = [1]
  for (let i = 0; i < grau; i++) {
    const novo = new Array<number>(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) {
      novo[j] ^= g[j]
      novo[j + 1] ^= mul(g[j], EXP[i])
    }
    g = novo
  }
  return g
}

function codigoCorrecao(dados: number[], grau: number): number[] {
  const g = polinomioGerador(grau)
  const resto = new Array<number>(grau).fill(0)
  for (const d of dados) {
    const fator = d ^ resto[0]
    resto.shift()
    resto.push(0)
    if (fator) for (let j = 0; j < grau; j++) resto[j] ^= mul(g[j + 1], fator)
  }
  return resto
}

/** Capacidade em bytes (modo byte, nível M) de cada versão 1..10. */
export function capacidadeBytes(versao: number): number {
  const esp = BLOCOS_M[versao - 1]
  const dados = esp.blocos.reduce((s, [q, n]) => s + q * n, 0)
  const bitsContagem = versao < 10 ? 8 : 16
  return Math.floor((dados * 8 - 4 - bitsContagem) / 8)
}

function montarCodewords(bytes: Uint8Array, versao: number): number[] {
  const esp = BLOCOS_M[versao - 1]
  const totalDados = esp.blocos.reduce((s, [q, n]) => s + q * n, 0)
  const bits: number[] = []
  const empurrar = (valor: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1) }
  empurrar(0b0100, 4)
  empurrar(bytes.length, versao < 10 ? 8 : 16)
  for (const b of bytes) empurrar(b, 8)
  empurrar(0, Math.min(4, totalDados * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const dados: number[] = []
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let alt = 0; dados.length < totalDados; alt ^= 1) dados.push(alt ? 0x11 : 0xec)

  // Divide em blocos, calcula a correção e intercala.
  const blocosDados: number[][] = []
  const blocosEc: number[][] = []
  let pos = 0
  for (const [quantidade, n] of esp.blocos) {
    for (let k = 0; k < quantidade; k++) {
      const bloco = dados.slice(pos, pos + n)
      pos += n
      blocosDados.push(bloco)
      blocosEc.push(codigoCorrecao(bloco, esp.ec))
    }
  }
  const saida: number[] = []
  const maior = Math.max(...blocosDados.map((b) => b.length))
  for (let i = 0; i < maior; i++) for (const b of blocosDados) if (i < b.length) saida.push(b[i])
  for (let i = 0; i < esp.ec; i++) for (const b of blocosEc) saida.push(b[i])
  return saida
}

const MASCARAS: Array<(linha: number, coluna: number) => boolean> = [
  (y, x) => (x + y) % 2 === 0,
  (y) => y % 2 === 0,
  (_y, x) => x % 3 === 0,
  (y, x) => (x + y) % 3 === 0,
  (y, x) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (y, x) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (y, x) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (y, x) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function penalidade(m: boolean[][]): number {
  const n = m.length
  let pontos = 0
  // Corridas de 5 ou mais módulos iguais (linhas e colunas)
  const corridas = (ler: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let corrida = 1
      for (let j = 1; j <= n; j++) {
        if (j < n && ler(i, j) === ler(i, j - 1)) { corrida++; continue }
        if (corrida >= 5) pontos += 3 + corrida - 5
        corrida = 1
      }
    }
  }
  corridas((i, j) => m[i][j])
  corridas((i, j) => m[j][i])
  // Padrão localizador falso (1:1:3:1:1 ladeado por 4 claros)
  const padrao = [true, false, true, true, true, false, true]
  const verificar = (ler: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j + 7 <= n; j++) {
        let bate = true
        for (let k = 0; k < 7; k++) if (ler(i, j + k) !== padrao[k]) { bate = false; break }
        if (!bate) continue
        const clarosAntes = j >= 4 && [1, 2, 3, 4].every((k) => !ler(i, j - k))
        const clarosDepois = j + 11 <= n && [7, 8, 9, 10].every((k) => !ler(i, j + k))
        if (clarosAntes || clarosDepois) pontos += 40
      }
    }
  }
  verificar((i, j) => m[i][j])
  verificar((i, j) => m[j][i])
  // Blocos 2×2
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < n; j++) {
    const c = m[i][j]
    if (m[i][j + 1] === c && m[i + 1][j] === c && m[i + 1][j + 1] === c) pontos += 3
  }
  // Proporção de escuros
  let escuros = 0
  for (const linha of m) for (const v of linha) if (v) escuros++
  const total = n * n
  const k = Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1
  pontos += Math.max(0, k) * 10
  return pontos
}

/** Gera a matriz de módulos de um texto. Lança erro se passar de 213 bytes. */
export function gerarQr(texto: string): MatrizQr {
  const bytes = new TextEncoder().encode(texto)
  let versao = 0
  for (let v = 1; v <= 10; v++) if (bytes.length <= capacidadeBytes(v)) { versao = v; break }
  if (!versao) throw new Error(`Texto longo demais para o QR (${bytes.length} bytes; máximo 213)`)

  const tamanho = 17 + 4 * versao
  const modulos: boolean[][] = Array.from({ length: tamanho }, () => new Array<boolean>(tamanho).fill(false))
  const funcao: boolean[][] = Array.from({ length: tamanho }, () => new Array<boolean>(tamanho).fill(false))
  const fixar = (linha: number, coluna: number, escuro: boolean) => {
    if (linha < 0 || coluna < 0 || linha >= tamanho || coluna >= tamanho) return
    modulos[linha][coluna] = escuro
    funcao[linha][coluna] = true
  }

  // Localizadores + separadores
  for (const [l0, c0] of [[0, 0], [0, tamanho - 7], [tamanho - 7, 0]]) {
    for (let dl = -1; dl <= 7; dl++) for (let dc = -1; dc <= 7; dc++) {
      const dentro = dl >= 0 && dl <= 6 && dc >= 0 && dc <= 6
      const escuro = dentro && (dl === 0 || dl === 6 || dc === 0 || dc === 6 || (dl >= 2 && dl <= 4 && dc >= 2 && dc <= 4))
      fixar(l0 + dl, c0 + dc, escuro)
    }
  }
  // Temporização
  for (let i = 8; i < tamanho - 8; i++) { fixar(6, i, i % 2 === 0); fixar(i, 6, i % 2 === 0) }
  // Alinhamento
  const pos = ALINHAMENTO[versao - 1]
  for (const l of pos) for (const c of pos) {
    if ((l <= 8 && c <= 8) || (l <= 8 && c >= tamanho - 9) || (l >= tamanho - 9 && c <= 8)) continue
    for (let dl = -2; dl <= 2; dl++) for (let dc = -2; dc <= 2; dc++) fixar(l + dl, c + dc, Math.max(Math.abs(dl), Math.abs(dc)) !== 1)
  }
  // Áreas reservadas do formato (preenchidas depois) e módulo escuro fixo
  for (let i = 0; i < 9; i++) if (i !== 6) { fixar(8, i, false); fixar(i, 8, false) }
  for (let i = 0; i < 8; i++) { fixar(8, tamanho - 1 - i, false); fixar(tamanho - 1 - i, 8, false) }
  fixar(tamanho - 8, 8, true)
  // Informação de versão (7+)
  if (versao >= 7) {
    let resto = versao
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25)
    const bits = (versao << 12) | resto
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1
      const a = tamanho - 11 + (i % 3)
      const b = Math.floor(i / 3)
      fixar(b, a, bit)
      fixar(a, b, bit)
    }
  }

  // Dados em zigue-zague
  const codewords = montarCodewords(bytes, versao)
  let i = 0
  const totalBits = codewords.length * 8
  for (let direita = tamanho - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5
    for (let vert = 0; vert < tamanho; vert++) {
      for (let j = 0; j < 2; j++) {
        const coluna = direita - j
        const subindo = ((direita + 1) & 2) === 0
        const linha = subindo ? tamanho - 1 - vert : vert
        if (!funcao[linha][coluna] && i < totalBits) {
          modulos[linha][coluna] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1
          i++
        }
      }
    }
  }

  // Escolha da máscara
  const aplicarFormato = (m: boolean[][], mascara: number) => {
    const dados = (0b00 << 3) | mascara // nível M = 00
    let resto = dados
    for (let k = 0; k < 10; k++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537)
    const bits = ((dados << 10) | resto) ^ 0x5412
    const bit = (k: number) => ((bits >>> k) & 1) === 1
    for (let k = 0; k <= 5; k++) m[k][8] = bit(k)
    m[7][8] = bit(6)
    m[8][8] = bit(7)
    m[8][7] = bit(8)
    for (let k = 9; k < 15; k++) m[8][14 - k] = bit(k)
    for (let k = 0; k < 8; k++) m[8][tamanho - 1 - k] = bit(k)
    for (let k = 8; k < 15; k++) m[tamanho - 15 + k][8] = bit(k)
    m[tamanho - 8][8] = true
  }
  let melhor: boolean[][] = modulos
  let melhorPontos = Infinity
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = modulos.map((linha) => linha.slice())
    for (let l = 0; l < tamanho; l++) for (let c = 0; c < tamanho; c++) if (!funcao[l][c] && MASCARAS[mascara](l, c)) m[l][c] = !m[l][c]
    aplicarFormato(m, mascara)
    const p = penalidade(m)
    if (p < melhorPontos) { melhorPontos = p; melhor = m }
  }
  return { versao, tamanho, modulos: melhor }
}

/** Caminho SVG ("M x y h1v1h-1z" por módulo escuro) com margem silenciosa em módulos. */
export function caminhoQr(matriz: MatrizQr, margem = 4): string {
  const partes: string[] = []
  for (let l = 0; l < matriz.tamanho; l++) {
    let c = 0
    while (c < matriz.tamanho) {
      if (!matriz.modulos[l][c]) { c++; continue }
      let fim = c
      while (fim < matriz.tamanho && matriz.modulos[l][fim]) fim++
      partes.push(`M${c + margem} ${l + margem}h${fim - c}v1h-${fim - c}z`)
      c = fim
    }
  }
  return partes.join('')
}

/** SVG completo do QR (string), pronto para `<img src="data:image/svg+xml,...">` ou para inserir no DOM. */
export function qrSvg(texto: string, opcoes: { margem?: number; cor?: string; fundo?: string } = {}): string {
  const { margem = 4, cor = '#0D0E23', fundo = '#FFFFFF' } = opcoes
  const m = gerarQr(texto)
  const lado = m.tamanho + margem * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${lado}" height="${lado}" fill="${fundo}"/><path d="${caminhoQr(m, margem)}" fill="${cor}"/></svg>`
}
