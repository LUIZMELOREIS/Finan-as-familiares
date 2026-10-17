/** Utilitários compartilhados pelas telas Lançar, Caixa de entrada e Contas. */
import type { CSSProperties } from 'react'
import jsQR from 'jsqr'
import type { Categoria, RegraLoja } from '../../tipos'
import { normalizar } from '../../util/formato'
import { sugerirCategoria } from '../../util/extrator'
import { corVar } from '../Icone'

/** `style={{ '--c': cor }}` tipado: a cor do grupo para `.menu-group`, `.chip`, `.ico`. */
export function estiloCor(cor: string | undefined): CSSProperties {
  return { ['--c' as string]: corVar(cor) } as CSSProperties
}

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

export function arquivoParaTexto(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result ?? ''))
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    leitor.readAsText(arquivo)
  })
}

/** Procura um QR Code na imagem (a NFC-e traz um com a URL da SEFAZ). */
export async function lerQrCode(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const escala = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const qr = jsQR(dados.data, dados.width, dados.height, { inversionAttempts: 'dontInvert' })
    return qr?.data ?? null
  } catch {
    return null
  }
}

export function ehUrlNfce(texto: string) {
  return /^https?:\/\//i.test(texto) && /nfce|sefaz|fazenda/i.test(texto)
}

/** RegrasLoja: a loja que o usuário já corrigiu cai sempre na categoria escolhida. */
export function categoriaPorRegraLoja(estabelecimento: string | undefined, regras: RegraLoja[], categorias: Categoria[]): string | undefined {
  const est = normalizar(estabelecimento || '')
  if (!est) return undefined
  const regra = regras.find((r) => r.loja_normalizada && est.includes(r.loja_normalizada))
  return regra && categorias.some((c) => c.id === regra.categoria_id) ? regra.categoria_id : undefined
}

/** Sugestão final: regra aprendida › categoria vinda da leitura › palavras-chave. */
export function sugestaoDeCategoria(texto: string | undefined, leituraCategoria: string | undefined, regras: RegraLoja[], categorias: Categoria[], tipo: 'despesa' | 'receita' = 'despesa'): string | undefined {
  return categoriaPorRegraLoja(texto, regras, categorias)
    ?? (leituraCategoria && categorias.some((c) => c.id === leituraCategoria) ? leituraCategoria : undefined)
    ?? (texto ? sugerirCategoria(texto, categorias, tipo)[0] : undefined)
}

/** Nome do cartão como na referência: "Itaú · final 4821 (Luiz)". */
export function nomeCartao(k: { apelido: string; final: string; titular_id: string }, usuarios: Array<{ id: string; apelido: string }>): string {
  const titular = usuarios.find((u) => u.id === k.titular_id)?.apelido
  return `${k.apelido} · final ${k.final}${titular ? ` (${titular})` : ''}`
}

/** Dias entre hoje e uma data ISO (negativo = já passou). */
export function diasAte(iso: string, hoje = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000)
}
