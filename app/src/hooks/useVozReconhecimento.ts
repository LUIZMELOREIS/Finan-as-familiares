/**
 * Reconhecimento de voz com a Web Speech API (pt-BR), usado em "Falar" e no
 * microfone do Assistente. Sem suporte (Safari em alguns casos), `suportado`
 * fica false e a tela sugere o microfone do teclado.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface ReconhecimentoMinimo {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type ConstrutorReconhecimento = new () => ReconhecimentoMinimo

function obterConstrutor(): ConstrutorReconhecimento | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

const MENSAGENS_ERRO: Record<string, string> = {
  'not-allowed': 'O microfone está bloqueado. Permita o uso do microfone nas configurações do navegador.',
  'no-speech': 'Não ouvimos nada. Toque e fale de novo.',
  'audio-capture': 'Não encontramos um microfone.',
  network: 'O reconhecimento de voz precisa de internet.',
}

export function useVozReconhecimento() {
  const [suportado] = useState(() => !!obterConstrutor())
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [final, setFinal] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const ref = useRef<ReconhecimentoMinimo | null>(null)

  const parar = useCallback(() => {
    ref.current?.stop()
    setOuvindo(false)
  }, [])

  const comecar = useCallback(() => {
    const Ctor = obterConstrutor()
    if (!Ctor) return
    setErro(null)
    setParcial('')
    setFinal('')
    const r = new Ctor()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let texto = ''
      for (let i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript
      setParcial(texto)
      const ultimo = e.results[e.results.length - 1]
      if (ultimo?.isFinal) setFinal(texto.trim())
    }
    r.onerror = (e) => {
      setErro(MENSAGENS_ERRO[e.error] ?? 'Não foi possível ouvir. Tente de novo ou digite.')
      setOuvindo(false)
    }
    r.onend = () => setOuvindo(false)
    ref.current = r
    try {
      r.start()
      setOuvindo(true)
    } catch {
      setErro('Não foi possível iniciar o microfone.')
    }
  }, [])

  useEffect(() => () => ref.current?.abort(), [])

  return { suportado, ouvindo, parcial, final, erro, comecar, parar }
}
