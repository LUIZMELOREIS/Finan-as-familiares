// Gera o brasão padrão da família: uma rosácea dourada de oito "luas" (crescentes) entrelaçadas.
// Escreve public/brasao.svg (favicon e base dos ícones) e src/componentes/brasao/rosacea.gerado.ts
// (as mesmas pétalas para o componente BrasaoPadrao). Depois rode `npm run icones`.
import { writeFileSync } from 'node:fs'

const f = (v) => v.toFixed(1)
const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0])
/** sweep=1 (sentido horário em SVG) partindo de P até Q em torno de c passa por M? */
function horario(c, P, Q, M) {
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const aP = ang(c, P)
  return norm(ang(c, M) - aP) < norm(ang(c, Q) - aP) ? 1 : 0
}

/**
 * Cada pétala é a diferença entre dois círculos iguais (raio rho·R) com centros A e B:
 * A fica a a·R do centro; B é A deslocado s·R numa direção girada phi graus. Oito cópias giradas.
 */
export function petalas({ n = 8, R = 200, a = 0.3, rho = 0.7, s = 0.26, phi = 120, giro = -90, cx = 256, cy = 256 } = {}) {
  const rad = (g) => (g * Math.PI) / 180
  const out = []
  for (let i = 0; i < n; i++) {
    const t = rad(giro + (360 / n) * i)
    const A = [cx + a * R * Math.cos(t), cy + a * R * Math.sin(t)]
    const B = [A[0] + s * R * Math.cos(t + rad(phi)), A[1] + s * R * Math.sin(t + rad(phi))]
    const r = rho * R
    const d = Math.hypot(B[0] - A[0], B[1] - A[1])
    const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2))
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ux = (B[0] - A[0]) / d, uy = (B[1] - A[1]) / d
    const P = [mx - uy * h, my + ux * h], Q = [mx + uy * h, my - ux * h]
    const M1 = [A[0] - ux * r, A[1] - uy * r]
    const M2 = [B[0] - ux * r, B[1] - uy * r]
    out.push(`M${f(P[0])} ${f(P[1])}A${f(r)} ${f(r)} 0 1 ${horario(A, P, Q, M1)} ${f(Q[0])} ${f(Q[1])}A${f(r)} ${f(r)} 0 0 ${horario(B, Q, P, M2)} ${f(P[0])} ${f(P[1])}Z`)
  }
  return out
}

export const GRADIENTE = [['0', '#FFE7A3'], ['0.55', '#F2C552'], ['1', '#A8782A']]
export const OPACIDADE = 0.72

const ps = petalas()
const defs = `<linearGradient id="ouro" x1="0" y1="0" x2="1" y2="1">${GRADIENTE.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1F2B"/><stop offset="1" stop-color="#0D0E23"/></linearGradient>
    ${defs}
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#fundo)"/>
  <g fill="url(#ouro)" fill-opacity="${OPACIDADE}">
    ${ps.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>
</svg>
`
writeFileSync(new URL('../public/brasao.svg', import.meta.url), svg)
writeFileSync(new URL('../src/componentes/brasao/rosacea.gerado.ts', import.meta.url),
  `// Gerado por scripts/gerar-brasao.mjs — não edite à mão.\nexport const PETALAS: readonly string[] = ${JSON.stringify(ps, null, 2)}\nexport const OPACIDADE_PETALA = ${OPACIDADE}\nexport const GRADIENTE_OURO: readonly (readonly [string, string])[] = ${JSON.stringify(GRADIENTE)}\n`)
console.log('brasao.svg e rosacea.gerado.ts gerados com', ps.length, 'pétalas')
