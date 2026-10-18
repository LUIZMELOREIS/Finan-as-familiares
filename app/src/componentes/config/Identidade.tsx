import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Config } from '../../tipos'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { Icone } from '../Icone'
import { BrasaoPadrao } from '../Brasao'
import { Campo, useAcao } from './comuns'

export const LEMA_PADRAO = '“Eu e a minha casa serviremos ao Senhor.” — Josué 24.15'

/** Recorta a foto no quadro 16:9 (1600×900) no próprio aparelho e comprime em JPEG. */
async function recortarCapa(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const L = 1600, A = 900
  const escala = Math.max(L / bitmap.width, A / bitmap.height)
  const w = bitmap.width * escala, h = bitmap.height * escala
  const canvas = document.createElement('canvas')
  canvas.width = L
  canvas.height = A
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem')
  ctx.drawImage(bitmap, (L - w) / 2, (A - h) / 2, w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao recortar'))), 'image/jpeg', 0.82))
}

/** Prévia da capa: foto + véu + brasão, como na tela de entrada. */
export function PreviaCapa({ config }: { config: Config }) {
  const [lema, ref] = (config.versiculo_lema || LEMA_PADRAO).split('—').map((s) => s.trim())
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '16 / 9', background: 'var(--side)' }} aria-label="Prévia da capa">
      {config.url_foto_capa && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${config.url_foto_capa}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,14,35,.55), rgba(13,14,35,.92))' }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', color: '#fff', padding: 12 }}>
        <div className="crest" style={{ width: 64, height: 64 }}>{config.url_brasao ? <img src={config.url_brasao} alt="" /> : <BrasaoPadrao tamanho={40} />}</div>
        <b style={{ fontSize: 15 }}>Família {config.sobrenome || config.nome_familia}</b>
        <small style={{ color: '#C9CAD6', fontStyle: 'italic', fontSize: 11.5 }}>{lema}{ref && <span style={{ color: 'var(--gold)', fontStyle: 'normal' }}> {ref}</span>}</small>
      </div>
    </div>
  )
}

export function Identidade() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState({ nome_familia: boot.config.nome_familia, sobrenome: boot.config.sobrenome, versiculo_lema: boot.config.versiculo_lema || LEMA_PADRAO })
  const refCapa = useRef<HTMLInputElement>(null)
  const refBrasao = useRef<HTMLInputElement>(null)
  const previa: Config = { ...boot.config, ...f }

  const salvarTextos = () => rodar(async () => {
    const c = await api<Config>('salvar_config', { config: f })
    atualizarConfig(c)
  }, 'Identidade salva.')

  const enviarCapa = (arquivo: File) => rodar(async () => {
    const blob = await recortarCapa(arquivo)
    const imagem_base64 = await arquivoParaBase64(blob)
    const { url } = await api<{ url: string }>('enviar_arquivo', { imagem_base64, mime: 'image/jpeg', pasta: 'Identidade da Família', nome_arquivo: 'capa-familia.jpg' })
    const c = await api<Config>('salvar_config', { config: { url_foto_capa: url } })
    atualizarConfig(c)
  }, 'Foto de capa atualizada.')

  const enviarBrasao = (arquivo: File) => rodar(async () => {
    const ehSvg = arquivo.type === 'image/svg+xml' || /\.svg$/i.test(arquivo.name)
    const blob = ehSvg ? arquivo : await comprimirImagem(arquivo, 512, 0.9)
    const imagem_base64 = await arquivoParaBase64(blob)
    const mime = ehSvg ? 'image/svg+xml' : blob.type || 'image/png'
    const { url } = await api<{ url: string }>('enviar_arquivo', { imagem_base64, mime, pasta: 'Identidade da Família', nome_arquivo: ehSvg ? 'brasao.svg' : 'brasao.png' })
    const c = await api<Config>('salvar_config', { config: { url_brasao: url } })
    atualizarConfig(c)
  }, 'Brasão atualizado.')

  const limpar = (campo: 'url_brasao' | 'url_foto_capa') => rodar(async () => {
    const c = await api<Config>('salvar_config', { config: { [campo]: '' } })
    atualizarConfig(c)
  }, campo === 'url_brasao' ? 'Voltamos ao brasão padrão.' : 'Foto de capa removida.')

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="card">
        <h3>Nome e lema <span className="sub">aparecem na barra lateral e na capa</span></h3>
        <Campo rotulo="Nome da família"><input className="campo" value={f.nome_familia} onChange={(e) => setF({ ...f, nome_familia: e.target.value })} placeholder="Família Reis" /></Campo>
        <Campo rotulo="Sobrenome"><input className="campo" value={f.sobrenome} onChange={(e) => setF({ ...f, sobrenome: e.target.value })} placeholder="Reis" /></Campo>
        <Campo rotulo="Lema (versículo)" ajuda="Formato: “texto” — referência. Pode ser desligado em Configurações › Fé.">
          <textarea className="campo" rows={2} value={f.versiculo_lema} onChange={(e) => setF({ ...f, versiculo_lema: e.target.value })} />
        </Campo>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-primary" disabled={ocupado} onClick={salvarTextos}><Icone nome="check" />Salvar</button>
          <button className="btn btn-ghost" disabled={ocupado} onClick={() => setF({ ...f, versiculo_lema: LEMA_PADRAO })}>Usar o lema padrão</button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Foto de capa <span className="sub">tela de entrada, 16:9</span></h3>
          <PreviaCapa config={previa} />
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '10px 0' }}>A foto é recortada em 1600×900 e comprimida no seu aparelho antes de subir para a pasta <b>Identidade da Família</b> no Drive.</p>
          <input ref={refCapa} type="file" accept="image/*" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; if (a) enviarCapa(a); e.target.value = '' }} />
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary" disabled={ocupado} onClick={() => refCapa.current?.click()}><Icone nome="image" />{boot.config.url_foto_capa ? 'Trocar foto' : 'Enviar foto'}</button>
            {boot.config.url_foto_capa && <button className="btn btn-ghost" disabled={ocupado} onClick={() => limpar('url_foto_capa')}><Icone nome="trash-2" />Remover</button>}
          </div>
        </div>

        <div className="card">
          <h3>Brasão <span className="sub">círculo da barra lateral e ícone do app</span></h3>
          <div className="flex items-center gap-4">
            <div className="crest" style={{ width: 84, height: 84 }}>{boot.config.url_brasao ? <img src={boot.config.url_brasao} alt="" /> : <BrasaoPadrao tamanho={52} />}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', flex: 1 }}>
              {boot.config.url_brasao ? 'A família usa um brasão próprio.' : 'A família usa o brasão padrão em traço dourado.'}<br />
              Monte um no construtor heráldico ou envie um arquivo PNG ou SVG (quadrado, fundo escuro).
            </div>
          </div>
          <input ref={refBrasao} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const a = e.target.files?.[0]; if (a) enviarBrasao(a); e.target.value = '' }} />
          <div className="flex gap-2 flex-wrap mt-3">
            <Link to="/brasao" className="btn btn-primary"><Icone nome="shield" />Montar brasão</Link>
            <button className="btn btn-ghost" disabled={ocupado} onClick={() => refBrasao.current?.click()}><Icone nome="upload" />Enviar PNG/SVG</button>
            {boot.config.url_brasao && <button className="btn btn-ghost" disabled={ocupado} onClick={() => limpar('url_brasao')}><Icone nome="undo-2" />Voltar ao padrão</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
