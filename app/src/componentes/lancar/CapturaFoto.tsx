/**
 * Fotografar cupom: câmera traseira → compressão no aparelho → prévia → QR da
 * NFC-e (`consultar_nfce`) ou leitura da imagem (`ler_imagem`, tipo cupom).
 */
import { useEffect, useRef, useState } from 'react'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { LeituraExtraida } from '../../tipos'
import { Icone } from '../Icone'
import { ehUrlNfce, lerQrCode } from './comuns'

export function CapturaFoto({ aoLer, aoErro, autoAbrir, arquivoInicial }: {
  aoLer: (leitura: LeituraExtraida, previa: string) => void
  aoErro: (mensagem: string) => void
  autoAbrir?: boolean
  /** Imagem que chegou por compartilhamento de outro app: é processada ao montar. */
  arquivoInicial?: File | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => { if (autoAbrir) inputRef.current?.click() }, [autoAbrir])
  useEffect(() => { if (arquivoInicial) void processar(arquivoInicial) }, [arquivoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function processar(arquivo: File) {
    setLendo(true)
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
        if (!leitura.anexo_url) leitura = await enviar(blob).then((l2) => ({ ...leitura, anexo_url: l2.anexo_url })).catch(() => leitura)
      } else {
        setMensagem('Lendo o cupom…')
        leitura = await enviar(blob)
      }
      aoLer(leitura, url)
    } catch (e) {
      aoErro(e instanceof Error ? e.message : 'Não conseguimos ler o cupom. Confira os dados ou tente outra foto.')
    } finally {
      setLendo(false)
    }
  }

  async function enviar(blob: Blob) {
    const imagem_base64 = await arquivoParaBase64(blob)
    return api<LeituraExtraida>('ler_imagem', { imagem_base64, mime: 'image/jpeg', tipo: 'cupom', nome_arquivo: `cupom_${Date.now()}.jpg` })
  }

  return (
    <div className="field">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Fotografar cupom" onChange={(e) => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} />
      {previa ? (
        <div className="flex items-center" style={{ gap: 10, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 9, padding: 6 }}>
          <img src={previa} alt="Prévia do cupom" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 7, flex: 'none', background: '#000' }} />
          <div className="flex-1 min-w-0" style={{ fontSize: 12, color: 'var(--muted)' }} role="status" aria-live="polite">
            {lendo ? (
              <span className="flex items-center" style={{ gap: 8 }}><span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--sel)' }} />{mensagem}</span>
            ) : 'Foto guardada com o lançamento.'}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={lendo}><Icone nome="camera" />Outra foto</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => inputRef.current?.click()} disabled={lendo} title="Fotografe o cupom inteiro, com boa luz. Se tiver QR Code, melhor ainda.">
          <Icone nome="camera" />Abrir a câmera
        </button>
      )}
    </div>
  )
}
