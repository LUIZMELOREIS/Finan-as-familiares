/**
 * Peças pequenas reutilizadas pelas telas de Configurações, Caixa de Entrada,
 * Contas da Casa e Captura: interruptor, seletor de mês, paleta de cores,
 * grade de ícones, abas, copiar/baixar.
 */
import { useState, type ReactNode } from 'react'
import { nomeCompetencia, somarMeses } from '../../util/formato'

/** Interruptor grande (liga/desliga) com rótulo e descrição. */
export function Interruptor({ ligado, aoMudar, rotulo, descricao, desabilitado }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; descricao?: string; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
      className="w-full flex items-center gap-3 text-left min-h-14 py-2 disabled:opacity-60"
    >
      <span className="flex-1">
        <span className="block font-semibold">{rotulo}</span>
        {descricao && <span className="block text-sm text-suave">{descricao}</span>}
      </span>
      <span className={`relative inline-block w-14 h-8 rounded-full transition-colors shrink-0 ${ligado ? 'bg-verde' : 'bg-borda'}`} aria-hidden>
        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${ligado ? 'left-7' : 'left-1'}`} />
      </span>
      <span className="text-sm w-16 text-right text-suave" aria-hidden>{ligado ? 'Ligado' : 'Desligado'}</span>
    </button>
  )
}

/** ‹ Outubro de 2026 › */
export function SeletorMes({ competencia, aoMudar, maxima }: { competencia: string; aoMudar: (c: string) => void; maxima?: string }) {
  const podeAvancar = !maxima || competencia < maxima
  return (
    <div className="flex items-center justify-between gap-2">
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, -1))} aria-label="Mês anterior"><span className="text-xl" aria-hidden>‹</span></button>
      <div className="font-bold text-lg text-center flex-1">{nomeCompetencia(competencia)}</div>
      <button className="botao botao-secundario !px-3" onClick={() => aoMudar(somarMeses(competencia, 1))} disabled={!podeAvancar} aria-label="Próximo mês"><span className="text-xl" aria-hidden>›</span></button>
    </div>
  )
}

export const PALETA = ['#5B5BE0', '#7776E6', '#BD55C7', '#E5535B', '#E0852F', '#F2C552', '#4CB963', '#2E8B57', '#4FA3E0', '#1F6FB2', '#8B5E3C', '#6B7280']

/** Paleta de ~12 cores + seletor livre. */
export function SeletorCor({ valor, aoMudar, rotulo = 'Cor' }: { valor: string; aoMudar: (c: string) => void; rotulo?: string }) {
  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex flex-wrap gap-2 items-center">
        {PALETA.map((c) => (
          <button key={c} type="button" onClick={() => aoMudar(c)} aria-label={`Cor ${c}`} aria-pressed={valor.toLowerCase() === c.toLowerCase()} className="w-12 h-12 rounded-full border-4 transition-transform" style={{ background: c, borderColor: valor.toLowerCase() === c.toLowerCase() ? 'var(--texto)' : 'transparent' }} />
        ))}
        <label className="w-12 h-12 rounded-full border-2 border-dashed border-borda flex items-center justify-center cursor-pointer overflow-hidden relative" title="Outra cor">
          <span aria-hidden>🎨</span>
          <input type="color" value={valor || '#5B5BE0'} onChange={(e) => aoMudar(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Escolher outra cor" />
        </label>
      </div>
    </div>
  )
}

export const EMOJIS = [
  '🏠', '🏢', '🏡', '🏛️', '🔑', '💡', '💧', '🔥', '🌐', '📱', '☎️', '📺', '🔁', '☂️', '🛡️', '📄',
  '🛒', '🥦', '🥖', '🍕', '🍔', '☕', '🍽️', '🎂', '🍷', '🧃', '💊', '🏥', '🩺', '🦷', '💇', '🧴',
  '⛽', '🚗', '🚌', '🚕', '🚲', '✈️', '🛵', '🅿️', '🎓', '📚', '✏️', '🎒', '👕', '👟', '👗', '🎁',
  '⚽', '🎮', '🎬', '🎵', '🎸', '🏕️', '🏖️', '🎡', '🐶', '🐱', '🐷', '🔧', '🧹', '🪴', '🛋️', '🧸',
  '💼', '💰', '💵', '🏦', '📈', '🪙', '✨', '🛠️', '🙏', '💛', '🌍', '🤝', '⛪', '📖', '🕊️', '⚠️',
]

/** Grade de emojis úteis + campo livre. */
export function SeletorIcone({ valor, aoMudar }: { valor: string; aoMudar: (i: string) => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div>
      <span className="rotulo">Ícone</span>
      <div className="flex items-center gap-2">
        <button type="button" className="botao botao-secundario !text-2xl !w-14" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-label="Escolher ícone">{valor || '❓'}</button>
        <input className="campo flex-1" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder="Ou digite/cole um emoji" aria-label="Ícone (emoji)" maxLength={4} />
      </div>
      {aberto && (
        <div className="grid grid-cols-8 gap-1 mt-2 max-h-56 overflow-y-auto p-1 rounded-xl bg-painel border border-borda">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className={`h-12 rounded-lg text-2xl ${e === valor ? 'bg-primaria' : 'hover:bg-card-hover'}`} onClick={() => { aoMudar(e); setAberto(false) }} aria-label={`Ícone ${e}`}>{e}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export interface Aba { id: string; rotulo: string; icone?: string; badge?: number }

/** Abas grandes, roláveis na horizontal. */
export function Abas({ abas, ativa, aoMudar }: { abas: Aba[]; ativa: string; aoMudar: (id: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-1 px-1" role="tablist">
      {abas.map((a) => (
        <button key={a.id} role="tab" aria-selected={ativa === a.id} onClick={() => aoMudar(a.id)} className={`botao shrink-0 ${ativa === a.id ? 'botao-primario' : 'botao-secundario'}`}>
          {a.icone && <span aria-hidden>{a.icone}</span>}
          <span>{a.rotulo}</span>
          {a.badge ? <span className="ml-1 bg-vermelho text-white text-xs font-bold rounded-full px-2 py-0.5">{a.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

/** Copia texto para a área de transferência (com reserva para navegadores antigos). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch { /* tenta o modo antigo */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Baixa um arquivo gerado no próprio celular/computador. */
export function baixarArquivo(nome: string, conteudo: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Campo com rótulo (atalho). */
export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-suave mt-1">{dica}</span>}
    </label>
  )
}

/** Bloco "Copiar": mostra um valor e um botão grande para copiar. */
export function LinhaCopiar({ rotulo, valor, avisar, mascarar }: { rotulo: string; valor: string; avisar: (t: string) => void; mascarar?: boolean }) {
  const [mostrar, setMostrar] = useState(!mascarar)
  const exibido = mostrar ? valor : valor.replace(/./g, '•').slice(0, 16)
  return (
    <div className="card p-3">
      <div className="text-xs text-suave uppercase tracking-wide font-semibold mb-1">{rotulo}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm break-all select-all">{exibido || '—'}</code>
        {mascarar && <button className="botao botao-fantasma !min-h-10 !px-2 text-sm" onClick={() => setMostrar((m) => !m)}>{mostrar ? '🙈 Ocultar' : '👁️ Mostrar'}</button>}
        <button className="botao botao-secundario !min-h-10 !px-3 text-sm" disabled={!valor} onClick={async () => avisar((await copiarTexto(valor)) ? `${rotulo} copiado ✅` : 'Não foi possível copiar')}>📋 Copiar</button>
      </div>
    </div>
  )
}

/** Converte um File em texto. */
export function arquivoParaTexto(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result ?? ''))
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    leitor.readAsText(arquivo)
  })
}
