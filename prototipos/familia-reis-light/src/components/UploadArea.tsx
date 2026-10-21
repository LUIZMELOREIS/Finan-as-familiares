import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'

interface Props { aoEscolher: (arquivo: File) => void }

/** ==== ÁREA DE UPLOAD: arrastar e soltar ou escolher PDF / imagem ==== */
export function UploadArea({ aoEscolher }: Props) {
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const receber = (lista: FileList | null) => {
    const arq = lista?.[0]
    if (arq) aoEscolher(arq)
  }

  return (
    <div
      className={`upload ${arrastando ? 'ativo' : ''}`}
      role="button" tabIndex={0}
      aria-label="Enviar PDF ou imagem"
      onClick={() => entrada.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') entrada.current?.click() }}
      onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files) }}
    >
      <FileUp size={28} aria-hidden="true" />
      <strong>Enviar PDF ou imagem</strong>
      <span>Extrato do banco, fatura em PDF ou captura de tela. Arraste aqui ou toque para escolher.</span>
      <input ref={entrada} type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => receber(e.target.files)} />
    </div>
  )
  /* ==== FIM DA ÁREA DE UPLOAD ==== */
}
