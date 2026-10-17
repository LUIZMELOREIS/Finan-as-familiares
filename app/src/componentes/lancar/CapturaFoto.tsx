import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { LeituraExtraida } from '../../tipos'

/** Procura um QR Code na imagem (NFC-e tem um com a URL da SEFAZ). */
async function lerQrCode(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const lado = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * lado)
    canvas.height = Math.round(bitmap.height * lado)
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

function ehUrlNfce(texto: string) {
  return /^https?:\/\//i.test(texto) && /nfce|sefaz|fazenda/i.test(texto)
}

/**
 * Foto do cupom: abre a câmera traseira, comprime, mostra prévia, tenta o QR da NFC-e
 * (→ consultar_nfce) e senão manda a imagem para `ler_imagem` (tipo cupom).
 */
export function CapturaFoto({ aoLer, aoCancelar }: {
  aoLer: (leitura: LeituraExtraida, previa: string) => void
  aoCancelar: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<'esperando' | 'lendo' | 'erro'>('esperando')
  const [mensagem, setMensagem] = useState('Lendo o cupom…')
  const [erro, setErro] = useState<string | null>(null)

  // Abre a câmera assim que a tela aparece.
  useEffect(() => { inputRef.current?.click() }, [])

  async function processar(arquivo: File) {
    setErro(null)
    setEtapa('lendo')
    setMensagem('Preparando a foto…')
    const blob = await comprimirImagem(arquivo)
    const url = URL.createObjectURL(blob)
    setPrevia(url)
    try {
      setMensagem('Procurando o QR Code da nota…')
      const qr = await lerQrCode(blob)
      let leitura: LeituraExtraida
      if (qr && ehUrlNfce(qr)) {
        setMensagem('Consultando a nota fiscal…')
        leitura = await api<LeituraExtraida>('consultar_nfce', { url_qr: qr })
        if (!leitura.anexo_url) {
          // Guarda a foto mesmo assim (quando há servidor), sem travar o fluxo se falhar.
          leitura = await enviarFoto(blob).then((l2) => ({ ...leitura, anexo_url: l2.anexo_url })).catch(() => leitura)
        }
      } else {
        setMensagem('Lendo o cupom…')
        leitura = await enviarFoto(blob)
      }
      aoLer(leitura, url)
    } catch (e) {
      setEtapa('erro')
      setErro(e instanceof Error ? e.message : 'Não conseguimos ler o cupom.')
    }
  }

  async function enviarFoto(blob: Blob) {
    const imagem_base64 = await arquivoParaBase64(blob)
    return api<LeituraExtraida>('ler_imagem', { imagem_base64, mime: 'image/jpeg', tipo: 'cupom', nome_arquivo: `cupom_${Date.now()}.jpg` })
  }

  return (
    <div className="flex flex-col flex-1 gap-4">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} aria-label="Tirar foto do cupom" />

      <div className="card flex-1 min-h-72 flex flex-col items-center justify-center overflow-hidden relative">
        {previa ? <img src={previa} alt="Prévia do cupom" className="absolute inset-0 w-full h-full object-contain bg-black/40" /> : (
          <div className="text-center p-6">
            <div className="text-6xl mb-2" aria-hidden>📷</div>
            <p className="text-suave">Fotografe o cupom inteiro, com boa luz. Se tiver QR Code, melhor ainda.</p>
          </div>
        )}
        {etapa === 'lendo' && (
          <div className="absolute inset-0 bg-app/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <div className="w-14 h-14 rounded-full border-4 border-borda border-t-primaria animate-spin" />
            <div className="font-bold text-lg pulsar">{mensagem}</div>
            <div className="text-sm text-suave">Isso leva alguns segundos</div>
          </div>
        )}
      </div>

      {erro && <div className="card p-3 border-vermelho text-sm"><span aria-hidden>⚠️</span> {erro} Você pode tentar outra foto ou digitar o valor.</div>}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="botao botao-secundario !min-h-14" onClick={aoCancelar}><span aria-hidden>←</span> Voltar</button>
        <button type="button" className="botao botao-primario !min-h-14" onClick={() => inputRef.current?.click()} disabled={etapa === 'lendo'}>
          <span aria-hidden>📷</span> {previa ? 'Outra foto' : 'Abrir câmera'}
        </button>
      </div>
      {etapa === 'erro' && (
        <button type="button" className="botao botao-fantasma w-full" onClick={() => aoLer({ confianca: 0, origem_leitura: 'regex' }, previa ?? '')}>Digitar os dados mesmo assim →</button>
      )}
    </div>
  )
}
