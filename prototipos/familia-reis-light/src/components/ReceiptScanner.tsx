import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

interface Props { aoCapturar: (imagemDataUrl: string) => void }

/**
 * ==== CÂMERA COM GUIA QUADRADA ====
 * "Tirar foto" abre a câmera traseira com um quadro para centralizar o cupom.
 * Sem permissão ou sem getUserMedia, cai no seletor nativo (<input capture>).
 */
export function ReceiptScanner({ aoCapturar }: Props) {
  const [aberta, setAberta] = useState(false)
  const [erro, setErro] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const entradaArquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberta) return
    let cancelado = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return }
        stream.current = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => { setErro('Não foi possível abrir a câmera. Use o botão de arquivo abaixo.'); setAberta(false); entradaArquivo.current?.click() })
    return () => { cancelado = true; stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  }, [aberta])

  const fotografar = () => {
    const v = video.current
    if (!v) return
    const lado = Math.min(v.videoWidth, v.videoHeight)           // recorta o quadrado central, igual à guia
    const canvas = document.createElement('canvas')
    canvas.width = lado; canvas.height = lado
    canvas.getContext('2d')?.drawImage(v, (v.videoWidth - lado) / 2, (v.videoHeight - lado) / 2, lado, lado, 0, 0, lado, lado)
    setAberta(false)
    aoCapturar(canvas.toDataURL('image/jpeg', 0.9))
  }

  const lerArquivo = (arq: File | undefined) => {
    if (!arq) return
    const leitor = new FileReader()
    leitor.onload = () => aoCapturar(String(leitor.result))
    leitor.readAsDataURL(arq)
  }

  return (
    <section aria-label="Fotografar cupom">
      {aberta ? (
        <div className="scanner">
          <video ref={video} autoPlay playsInline muted />
          <div className="guia" aria-hidden="true"><div className="quadro" /></div>
          <p className="dica">Centralize o cupom dentro do quadro</p>
          <div className="acoes">
            <button type="button" className="obturador" aria-label="Fotografar" onClick={fotografar} />
          </div>
          <button type="button" className="icon-btn" style={{ position: 'absolute', top: 10, right: 10 }} aria-label="Fechar câmera" onClick={() => setAberta(false)}><X size={20} /></button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-block" onClick={() => { setErro(''); setAberta(true) }}>
          <Camera size={20} aria-hidden="true" /> Tirar foto do cupom
        </button>
      )}
      {erro && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{erro}</p>}
      <input ref={entradaArquivo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => lerArquivo(e.target.files?.[0])} />
    </section>
  )
  /* ==== FIM DA CÂMERA ==== */
}
