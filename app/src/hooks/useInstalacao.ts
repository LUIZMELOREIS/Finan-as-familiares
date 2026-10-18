/**
 * Instalação do PWA na tela inicial: detecta se já está instalado (standalone),
 * se é iPhone/iPad (Safari: Compartilhar › Adicionar à Tela de Início) e captura o
 * `beforeinstallprompt` do Android/Chrome para instalar com um toque.
 */
import { useEffect, useState } from 'react'

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: EventoInstalacao | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoGuardado = e as EventoInstalacao })
}

export function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function ehIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

export function useInstalacao() {
  const [instalado, setInstalado] = useState(estaInstalado)
  const [podeInstalar, setPodeInstalar] = useState(!!eventoGuardado)

  useEffect(() => {
    const aoPoder = (e: Event) => { e.preventDefault(); eventoGuardado = e as EventoInstalacao; setPodeInstalar(true) }
    const aoInstalar = () => { setInstalado(true); eventoGuardado = null; setPodeInstalar(false) }
    window.addEventListener('beforeinstallprompt', aoPoder)
    window.addEventListener('appinstalled', aoInstalar)
    const mq = window.matchMedia('(display-mode: standalone)')
    const aoMudar = () => setInstalado(estaInstalado())
    mq.addEventListener('change', aoMudar)
    return () => { window.removeEventListener('beforeinstallprompt', aoPoder); window.removeEventListener('appinstalled', aoInstalar); mq.removeEventListener('change', aoMudar) }
  }, [])

  const instalar = async () => {
    if (!eventoGuardado) return false
    await eventoGuardado.prompt()
    const { outcome } = await eventoGuardado.userChoice
    if (outcome === 'accepted') { setInstalado(true); setPodeInstalar(false); eventoGuardado = null; return true }
    return false
  }

  return { instalado, podeInstalar, instalar, ios: ehIos() }
}
