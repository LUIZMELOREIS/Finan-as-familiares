/**
 * Gráficos do Painel em SVG próprio — cópia das funções `spark`, `donut`, barras,
 * anéis, detalhamento e linhas do referencia_visual.html (mesmos viewBox, raios,
 * espessuras e cores; previsão com opacidade 0,35 e tracejado).
 */
import { useId } from 'react'
import { HEX } from '../Icone'
import { brl, M, rotuloEixo, tetoEixo } from './formato'

const EIXO = '#2C2E3A'
const TEXTO = '#ECECF2'
const SUB = '#8E90A2'
const TRILHO = '#2B2C37'
const FUNDO_CARD = '#1E1F26'

/* ---------- sparkline em área com gradiente ---------- */
export function Spark({ dados, cor }: { dados: number[]; cor: string }) {
  const id = useId().replace(/:/g, '')
  if (dados.length < 2) return <svg className="spark" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true" />
  const w = 300, h = 80
  const lo = Math.min(...dados), hi = Math.max(...dados)
  let min = lo >= 0 ? lo * 0.9 : lo * 1.1
  let max = hi >= 0 ? hi * 1.05 : hi * 0.95
  if (max <= min) { max = min + 1; min -= 1 }
  const pts = dados.map((v, i) => [i * (w / (dados.length - 1)), h - ((v - min) / (max - min)) * h * 0.9] as const)
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity=".75" />
          <stop offset="1" stopColor={cor} stopOpacity=".05" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ---------- donut ---------- */
export interface FatiaDonut { k: string; c: string; v: number }
export function Donut({ fatias, centro, sub, aoClicar }: { fatias: FatiaDonut[]; centro: string; sub: string; aoClicar?: (fatia: FatiaDonut) => void }) {
  const comValor = fatias.filter((f) => f.v > 0)
  const total = comValor.reduce((s, f) => s + f.v, 0)
  const R = 44, r = 2 * Math.PI * R
  let off = 0
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${centro} ${sub}`}>
        {total > 0 ? comValor.map((f) => {
          const len = (f.v / total) * r
          const el = (
            <circle key={f.k} cx="60" cy="60" r={R} fill="none" stroke={f.c} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 1.5)} ${r - len + 1.5}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" style={aoClicar ? { cursor: 'pointer' } : undefined} onClick={aoClicar ? () => aoClicar(f) : undefined}>
              <title>{`${f.k}: ${brl(f.v)}`}</title>
            </circle>
          )
          off += len
          return el
        }) : <circle cx="60" cy="60" r={R} fill="none" stroke={TRILHO} strokeWidth="13" />}
        <text x="60" y="60" textAnchor="middle" fill={TEXTO} fontSize="17" fontWeight="600" fontFamily="Poppins">{centro}</text>
        <text x="60" y="75" textAnchor="middle" fill={SUB} fontSize="7.5" fontFamily="Poppins">{sub}</text>
      </svg>
      <div className="donut-legend">
        {fatias.map((f) => aoClicar
          ? <button key={f.k} type="button" onClick={() => aoClicar(f)} title={brl(f.v)} style={{ padding: '0 4px' }}><i style={{ background: f.c, flex: 'none' }} />{f.k}</button>
          : <span key={f.k}><i style={{ background: f.c }} />{f.k}</span>)}
      </div>
    </div>
  )
}

/* ---------- barras mensais agrupadas (Salários × Outras receitas) ---------- */
export function BarrasMensais({ salarios, outras, previsto, mesAtual, aoClicarMes }: { salarios: number[]; outras: number[]; previsto: boolean[]; mesAtual: number; aoClicarMes?: (i: number) => void }) {
  const W = 560, H = 210, L = 52, B = 24, T = 8
  const max = tetoEixo(Math.max(...salarios, ...outras, 0))
  const cw = (W - L) / 12
  const grade = [0, 1, 2, 3, 4].map((g) => { const v = (max / 4) * g; return { v, y: H - B - (v / max) * (H - B - T) } })
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receitas por mês: salários e outras receitas">
      {grade.map((g) => (
        <g key={g.v}>
          <line x1={L} x2={W} y1={g.y} y2={g.y} stroke={EIXO} strokeWidth="1" />
          <text className="axis" x={L - 6} y={g.y + 3} textAnchor="end">{rotuloEixo(g.v)}</text>
        </g>
      ))}
      {M.map((m, i) => {
        const x = L + i * cw + cw / 2, op = previsto[i] ? 0.35 : 1
        const h1 = ((salarios[i] ?? 0) / max) * (H - B - T), h2 = ((outras[i] ?? 0) / max) * (H - B - T)
        return (
          <g key={m} style={aoClicarMes ? { cursor: 'pointer' } : undefined} onClick={aoClicarMes ? () => aoClicarMes(i) : undefined}>
            <title>{`${m}: salários ${brl(salarios[i] ?? 0)} · outras ${brl(outras[i] ?? 0)}${previsto[i] ? ' (previsto)' : ''}`}</title>
            <rect x={x - cw / 2} y={T} width={cw} height={H - T} fill="transparent" />
            <rect x={x - 10} y={H - B - h1} width="9" height={h1} rx="2" fill={HEX.indigo} opacity={op} />
            <rect x={x + 1} y={H - B - h2} width="9" height={h2} rx="2" fill={HEX.magenta} opacity={op} />
            <text className="axis" x={x} y={H - 7} textAnchor="middle" style={i === mesAtual ? { fill: TEXTO } : undefined}>{m}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ---------- anéis de participação ---------- */
export interface Anel { k: string; c: string; p: number }
export function Aneis({ aneis, aoClicar }: { aneis: Anel[]; aoClicar?: (a: Anel) => void }) {
  const R = 26, r = 2 * Math.PI * R
  return (
    <div className="rings">
      {aneis.map((a) => {
        const conteudo = (
          <>
            <svg viewBox="0 0 70 70" role="img" aria-label={`${a.k}: ${Math.round(a.p * 100)}% da receita do ano`}>
              <circle cx="35" cy="35" r={R} fill="none" stroke={TRILHO} strokeWidth="6" />
              <circle cx="35" cy="35" r={R} fill="none" stroke={a.c} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.min(1, Math.max(0, a.p)) * r} ${r}`} transform="rotate(-90 35 35)" />
              <text x="35" y="39" textAnchor="middle" fill={TEXTO} fontSize="12" fontWeight="600" fontFamily="Poppins">{Math.round(a.p * 100)}%</text>
            </svg>
            <span>{a.k}</span>
          </>
        )
        return aoClicar
          ? <button key={a.k} type="button" onClick={() => aoClicar(a)} style={{ display: 'block', width: '100%', color: 'inherit' }}>{conteudo}</button>
          : <div key={a.k}>{conteudo}</div>
      })}
    </div>
  )
}

/* ---------- detalhamento: barras horizontais + lista de grupos ---------- */
export interface BarraH { id: string; nome: string; valor: number }
export function Detalhamento({ barras, cor, grupos, selecionado, aoSelecionar, aoClicarBarra, vazio }: {
  barras: BarraH[]; cor: string; grupos: string[]; selecionado: string; aoSelecionar: (g: string) => void; aoClicarBarra?: (b: BarraH) => void; vazio?: string
}) {
  const mx = Math.max(...barras.map((b) => b.valor), 0)
  return (
    <div className="detail">
      <div className="hbars">
        {barras.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>{vazio ?? 'Sem lançamentos neste grupo no mês.'}</p>}
        {barras.map((b) => (
          <div className="hb" key={b.id}>
            <span className="lbl" title={b.nome}>{b.nome}</span>
            <button type="button" className="track" onClick={aoClicarBarra ? () => aoClicarBarra(b) : undefined} style={{ width: '100%', color: 'inherit', padding: 0, minHeight: 24 }} aria-label={`${b.nome}: ${brl(b.valor)}`}>
              <div className="fill" style={{ width: `${mx ? (b.valor / mx) * 72 : 0}%`, background: cor }} />
              <span className="num">{brl(b.valor)}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="cats">
        {grupos.map((g) => <button key={g} type="button" aria-pressed={g === selecionado} onClick={() => aoSelecionar(g)}>{g}</button>)}
      </div>
    </div>
  )
}

/* ---------- receitas × despesas (linhas, previsão tracejada) ---------- */
export function LinhasReceitaDespesa({ receitas, despesas, reais, mesAtual, aoClicarMes }: { receitas: number[]; despesas: number[]; reais: number; mesAtual: number; aoClicarMes?: (i: number) => void }) {
  const W = 560, H = 210, L = 52, B = 24, T = 10
  const max = tetoEixo(Math.max(...receitas, ...despesas, 0))
  const cw = (W - L - 14) / 11
  const y = (v: number) => H - B - (v / max) * (H - B - T)
  const caminho = (a: number[], inicio: number) => a.slice(inicio).map((v, j) => {
    const i = inicio + j, x = L + i * cw
    if (!j) return `M${x},${y(v)}`
    const px = L + (i - 1) * cw, cx = (px + x) / 2
    return `C${cx},${y(a[i - 1])} ${cx},${y(v)} ${x},${y(v)}`
  }).join(' ')
  const real = (a: number[]) => a.slice(0, reais)
  const grade = [0, 1, 2, 3, 4].map((g) => (max / 4) * g)
  const temReal = reais >= 1
  const temProj = reais < 12
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receitas e despesas por mês">
      {grade.map((v) => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={EIXO} />
          <text className="axis" x={L - 6} y={y(v) + 3} textAnchor="end">{rotuloEixo(v)}</text>
        </g>
      ))}
      {temReal && <path d={caminho(real(receitas), 0)} fill="none" stroke={HEX.indigo} strokeWidth="2.5" />}
      {temReal && <path d={caminho(real(despesas), 0)} fill="none" stroke={HEX.magenta} strokeWidth="2.5" />}
      {temProj && <path d={caminho(receitas, Math.max(0, reais - 1))} fill="none" stroke={HEX.indigo} strokeWidth="2" strokeDasharray="4 4" opacity=".6" />}
      {temProj && <path d={caminho(despesas, Math.max(0, reais - 1))} fill="none" stroke={HEX.magenta} strokeWidth="2" strokeDasharray="4 4" opacity=".6" />}
      {M.map((m, i) => (
        <g key={m} style={aoClicarMes ? { cursor: 'pointer' } : undefined} onClick={aoClicarMes ? () => aoClicarMes(i) : undefined}>
          <title>{`${m}: receita ${brl(receitas[i] ?? 0)} · despesa ${brl(despesas[i] ?? 0)}`}</title>
          <rect x={L + i * cw - cw / 2} y={T} width={cw} height={H - T} fill="transparent" />
          <text className="axis" x={L + i * cw} y={H - 7} textAnchor="middle" style={i === mesAtual ? { fill: TEXTO } : undefined}>{m}</text>
        </g>
      ))}
      {mesAtual >= 0 && mesAtual < 12 && (
        <>
          <circle cx={L + mesAtual * cw} cy={y(receitas[mesAtual] ?? 0)} r="4" fill={HEX.indigo} stroke={FUNDO_CARD} strokeWidth="2" />
          <circle cx={L + mesAtual * cw} cy={y(despesas[mesAtual] ?? 0)} r="4" fill={HEX.magenta} stroke={FUNDO_CARD} strokeWidth="2" />
        </>
      )}
    </svg>
  )
}
