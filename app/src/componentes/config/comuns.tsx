/**
 * Peças compartilhadas pelas telas de Configurações: interruptor, seletor de cor
 * da paleta, seletor de ícone Lucide, botão Copiar, QR Code e o hook de ações.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CorPaleta } from '../../tipos'
import { useSessao } from '../../store/sessao'
import { Icone, NOMES_ICONES_CARDAPIO, corVar } from '../Icone'
import { caminhoQr, gerarQr } from './qr'

/** Interruptor `.switch` da referência, com área de toque de 44 px. */
export function Interruptor({ ligado, aoMudar, rotulo, desabilitado }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; desabilitado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} onClick={() => aoMudar(!ligado)}
      style={{ minHeight: 44, minWidth: 44, display: 'grid', placeItems: 'center', margin: '-12px -5px' }}>
      <span className="switch" aria-checked={ligado} aria-hidden="true" />
    </button>
  )
}

/** Linha "título + descrição + interruptor" usada em vários cards. */
export function LinhaInterruptor({ titulo, descricao, ligado, aoMudar, desabilitado }: { titulo: string; descricao?: string; ligado: boolean; aoMudar: (v: boolean) => void; desabilitado?: boolean }) {
  return (
    <div className="row" style={{ minHeight: 52 }}>
      <div className="t"><b>{titulo}</b>{descricao && <small>{descricao}</small>}</div>
      <Interruptor ligado={ligado} aoMudar={aoMudar} rotulo={titulo} desabilitado={desabilitado} />
    </div>
  )
}

export function Campo({ rotulo, children, ajuda }: { rotulo: string; children: ReactNode; ajuda?: string }) {
  return (
    <div className="field">
      <label>{rotulo}</label>
      {children}
      {ajuda && <small style={{ color: 'var(--faint)', fontSize: 11.5 }}>{ajuda}</small>}
    </div>
  )
}

export const CORES_PALETA: Array<{ id: CorPaleta; nome: string }> = [
  { id: 'indigo', nome: 'Índigo' }, { id: 'sel', nome: 'Violeta' }, { id: 'magenta', nome: 'Magenta' }, { id: 'gold', nome: 'Ouro' },
  { id: 'orange', nome: 'Laranja' }, { id: 'green', nome: 'Verde' }, { id: 'red', nome: 'Vermelho' }, { id: 'lilac', nome: 'Lilás' },
  { id: 'rose', nome: 'Rosa' }, { id: 'slate', nome: 'Ardósia' },
]

/** Bolinhas da paleta (só as 10 cores do contrato visual). */
export function SeletorCor({ valor, aoMudar }: { valor: string; aoMudar: (c: CorPaleta) => void }) {
  return (
    <div className="flex flex-wrap" role="radiogroup" aria-label="Cor">
      {CORES_PALETA.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={valor === c.id} aria-label={c.nome} title={c.nome} onClick={() => aoMudar(c.id)}
          style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: corVar(c.id), boxShadow: valor === c.id ? '0 0 0 2px var(--card), 0 0 0 4px var(--text)' : 'none' }} />
        </button>
      ))}
    </div>
  )
}

/** Grade de ícones Lucide do cardápio, com busca por nome. */
export function SeletorIcone({ valor, aoMudar, cor }: { valor: string; aoMudar: (nome: string) => void; cor?: string }) {
  const [busca, setBusca] = useState('')
  const nomes = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return b ? NOMES_ICONES_CARDAPIO.filter((n) => n.includes(b)) : NOMES_ICONES_CARDAPIO
  }, [busca])
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="ico" style={{ ['--c' as string]: corVar(cor) }}><Icone nome={valor} /></span>
        <input className="campo" placeholder="Buscar ícone (ex.: car, house, gift)" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ícone" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4, maxHeight: 220, overflowY: 'auto' }} role="radiogroup" aria-label="Ícone">
        {nomes.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={n} title={n} onClick={() => aoMudar(n)}
            style={{ width: '100%', aspectRatio: '1', minHeight: 44, borderRadius: 8, display: 'grid', placeItems: 'center', background: valor === n ? 'var(--indigo)' : 'var(--card-2)', color: valor === n ? '#fff' : 'var(--text)' }}>
            <Icone nome={n} />
          </button>
        ))}
        {!nomes.length && <small style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>Nenhum ícone com esse nome.</small>}
      </div>
    </div>
  )
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function BotaoCopiar({ texto, rotulo = 'Copiar', pequeno = true, className = '' }: { texto: string; rotulo?: string; pequeno?: boolean; className?: string }) {
  const avisar = useSessao((e) => e.avisar)
  return (
    <button type="button" className={`btn btn-ghost ${pequeno ? 'btn-sm' : ''} ${className}`} style={{ minHeight: 44 }}
      onClick={async () => { (await copiarTexto(texto)) ? avisar('Copiado.', { tipo: 'ok' }) : avisar('Não foi possível copiar. Selecione o texto e copie manualmente.', { tipo: 'erro' }) }}>
      <Icone nome="copy" />{rotulo}
    </button>
  )
}

/** Campo somente leitura com botão Copiar ao lado. */
export function CampoCopiavel({ rotulo, valor, segredo }: { rotulo: string; valor: string; segredo?: boolean }) {
  const [mostrar, setMostrar] = useState(!segredo)
  return (
    <div className="field">
      <label>{rotulo}</label>
      <div className="flex gap-2 items-center">
        <input className="campo num" readOnly value={mostrar ? valor : '•'.repeat(Math.min(valor.length, 24))} onFocus={(e) => e.target.select()} aria-label={rotulo} style={{ fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', minWidth: 0, flex: 1 }} />
        {segredo && <button type="button" className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => setMostrar((m) => !m)} aria-label={mostrar ? 'Esconder' : 'Mostrar'}><Icone nome={mostrar ? 'eye-off' : 'eye'} /></button>}
        <BotaoCopiar texto={valor} />
      </div>
    </div>
  )
}

/** QR Code gerado localmente (sem serviço externo). */
export function QrCode({ texto, tamanho = 220 }: { texto: string; tamanho?: number }) {
  const matriz = useMemo(() => { try { return gerarQr(texto) } catch { return null } }, [texto])
  if (!matriz) return <small style={{ color: 'var(--muted)' }}>Link longo demais para virar QR Code; use o botão Copiar.</small>
  const lado = matriz.tamanho + 8
  return (
    <svg viewBox={`0 0 ${lado} ${lado}`} width={tamanho} height={tamanho} shapeRendering="crispEdges" role="img" aria-label="QR Code do convite" style={{ borderRadius: 10 }}>
      <rect width={lado} height={lado} fill="#FFFFFF" />
      <path d={caminhoQr(matriz, 4)} fill="#0D0E23" />
    </svg>
  )
}

/** Linha do índice de Configurações: ícone, nome, descrição e chevron. */
export function LinhaIndice({ para, icone, nome, descricao }: { para: string; icone: string; nome: string; descricao: string }) {
  return (
    <Link to={para} className="row" style={{ textDecoration: 'none', color: 'inherit', minHeight: 56 }}>
      <span className="ico-sm"><Icone nome={icone} /></span>
      <span className="t"><b>{nome}</b><small>{descricao}</small></span>
      <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
    </Link>
  )
}

/** Executa uma ação assíncrona com estado "ocupado" e avisos de sucesso/erro. */
export function useAcao() {
  const [ocupado, setOcupado] = useState(false)
  const avisar = useSessao((e) => e.avisar)
  const rodar = useCallback(async <T,>(fn: () => Promise<T>, mensagemOk?: string): Promise<T | undefined> => {
    setOcupado(true)
    try {
      const r = await fn()
      if (mensagemOk) avisar(mensagemOk, { tipo: 'ok' })
      return r
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível concluir.', { tipo: 'erro' })
      return undefined
    } finally {
      setOcupado(false)
    }
  }, [avisar])
  return { rodar, ocupado }
}

/** Baixa um Blob/texto como arquivo. */
export function baixarArquivo(conteudo: Blob | string, nome: string, mime = 'application/octet-stream') {
  const blob = typeof conteudo === 'string' ? new Blob([conteudo], { type: mime }) : conteudo
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const PERFIS = ['Administrador', 'Adulto', 'Dependente'] as const
