import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, arquivoParaBase64 } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Config } from '../../tipos'
import { Campo } from './comuns'

const LEMA_PADRAO = '"Eu e a minha casa serviremos ao Senhor." — Josué 24:15'

/** Recorta a imagem no formato 16:9 (1600×900), centralizada, e comprime em JPEG. */
async function recortarCapa(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const L = 1600, A = 900
  const escala = Math.max(L / bitmap.width, A / bitmap.height)
  const lw = bitmap.width * escala, lh = bitmap.height * escala
  const canvas = document.createElement('canvas')
  canvas.width = L
  canvas.height = A
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(bitmap, (L - lw) / 2, (A - lh) / 2, lw, lh)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao recortar'))), 'image/jpeg', 0.82))
}

export function Identidade() {
  const boot = useBoot()
  const nav = useNavigate()
  const avisar = useSessao((e) => e.avisar)
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const c = boot.config
  const [nome, setNome] = useState(c.nome_familia)
  const [sobrenome, setSobrenome] = useState(c.sobrenome)
  const [lema, setLema] = useState(c.versiculo_lema || LEMA_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState<'capa' | 'brasao' | null>(null)
  const refCapa = useRef<HTMLInputElement>(null)
  const refBrasao = useRef<HTMLInputElement>(null)

  async function salvarConfig(parcial: Partial<Config>, mensagem: string) {
    const novo = await api<Config>('salvar_config', { config: parcial })
    atualizarConfig({ ...parcial, ...(novo ?? {}) })
    avisar(mensagem, { tipo: 'ok' })
  }

  async function salvarTextos() {
    setSalvando(true)
    try { await salvarConfig({ nome_familia: nome.trim(), sobrenome: sobrenome.trim(), versiculo_lema: lema.trim() }, 'Identidade salva ✅') }
    catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  async function enviar(tipo: 'capa' | 'brasao', arquivo: File) {
    setEnviando(tipo)
    try {
      let blob: Blob = arquivo
      let mime = arquivo.type
      let nomeArq = arquivo.name
      if (tipo === 'capa') { blob = await recortarCapa(arquivo); mime = 'image/jpeg'; nomeArq = 'capa.jpg' }
      else if (!/image\/(png|svg\+xml|jpeg|webp)/.test(mime)) throw new Error('Envie um PNG ou SVG')
      const imagem_base64 = await arquivoParaBase64(blob)
      const r = await api<{ url: string }>('enviar_arquivo', { imagem_base64, mime, pasta: 'Identidade da Família', nome_arquivo: nomeArq })
      if (tipo === 'capa') await salvarConfig({ url_foto_capa: r.url }, 'Foto de capa atualizada ✅')
      else await salvarConfig({ url_brasao: r.url }, 'Brasão atualizado ✅')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Erro ao enviar', { tipo: 'erro' })
    } finally {
      setEnviando(null)
      if (refCapa.current) refCapa.current.value = ''
      if (refBrasao.current) refBrasao.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Prévia da capa */}
      <div className="card overflow-hidden">
        <div className="relative aspect-video bg-app flex items-end" style={c.url_foto_capa ? { backgroundImage: `url(${c.url_foto_capa})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(135deg, var(--primaria), var(--magenta))' }}>
          <div className="w-full p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
            <div className="flex items-center gap-3">
              {c.url_brasao ? <img src={c.url_brasao} alt="Brasão" className="w-14 h-14 drop-shadow" /> : <span className="text-4xl" aria-hidden>🏡</span>}
              <div className="min-w-0">
                <div className="font-extrabold text-lg truncate">{nome || 'Nome da família'}</div>
                <div className="text-xs italic opacity-90 line-clamp-2">{lema}</div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-suave p-3">Prévia de como a capa aparece na tela inicial.</p>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Nome e lema</h2>
        <Campo rotulo="Nome da família (aparece na capa)"><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Família Silva" /></Campo>
        <Campo rotulo="Sobrenome (usado nas iniciais do brasão)"><input className="campo" value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Silva" /></Campo>
        <Campo rotulo="Lema / versículo da família">
          <textarea className="campo" rows={3} value={lema} onChange={(e) => setLema(e.target.value)} />
        </Campo>
        <button className="botao botao-fantasma !min-h-10 text-sm" onClick={() => setLema(LEMA_PADRAO)}>Usar o padrão (Josué 24:15)</button>
        <button className="botao botao-primario w-full" onClick={salvarTextos} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar'}</button>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Foto de capa</h2>
        <p className="text-sm text-suave">Uma foto da família ou da casa. Recortamos no formato 16:9 (1600×900) aqui no celular antes de enviar.</p>
        <label className="botao botao-secundario w-full cursor-pointer">
          {enviando === 'capa' ? '⏳ Enviando…' : '📷 Enviar foto de capa'}
          <input ref={refCapa} type="file" accept="image/*" className="sr-only" disabled={!!enviando} onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar('capa', f) }} />
        </label>
        {c.url_foto_capa && <button className="botao botao-fantasma w-full" onClick={() => salvarConfig({ url_foto_capa: '' }, 'Foto removida').catch(() => avisar('Erro ao remover', { tipo: 'erro' }))}>🗑️ Remover foto</button>}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="titulo-secao">Brasão</h2>
        <p className="text-sm text-suave">O brasão aparece na capa e vira o ícone do app. Crie um aqui mesmo ou envie um pronto (PNG ou SVG).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button className="botao botao-primario" onClick={() => nav('/brasao')}>🛡️ Criar brasão</button>
          <label className="botao botao-secundario cursor-pointer">
            {enviando === 'brasao' ? '⏳ Enviando…' : '⬆️ Enviar brasão (PNG/SVG)'}
            <input ref={refBrasao} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" disabled={!!enviando} onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar('brasao', f) }} />
          </label>
        </div>
      </section>
    </div>
  )
}
