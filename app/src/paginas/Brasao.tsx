/**
 * Construtor heráldico clássico: escudo, até 2 esmaltes, partição, um móvel,
 * iniciais e listel com mote. Prévia ao vivo; resultado em SVG 512×512 (traço
 * dourado sobre azul-noite) que vira o brasão da família e os ícones 192/512.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import { Cabecalho } from '../componentes/Cabecalho'
import { Icone } from '../componentes/Icone'
import { Campo, baixarArquivo, useAcao } from '../componentes/config/comuns'
import {
  ESMALTES, FORMATOS, MOTES, MOVEIS, OPCOES_PADRAO, OURO, PARTICOES, gerarBrasaoSvg, pathsMovel, svgParaDataUrl, type OpcoesBrasao,
} from '../componentes/brasao/gerador'

const CHAVE_RASCUNHO = 'ff_brasao_rascunho'

function lerRascunho(): OpcoesBrasao {
  try { return { ...OPCOES_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || '{}') } } catch { return OPCOES_PADRAO }
}

/** Rasteriza o SVG num PNG quadrado do tamanho pedido. */
async function svgParaPng(svg: string, tamanho: number): Promise<Blob> {
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Não foi possível desenhar o brasão'))
    img.src = svgParaDataUrl(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = tamanho
  canvas.height = tamanho
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(img, 0, 0, tamanho, tamanho)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG'))), 'image/png'))
}

function MiniMovel({ id }: { id: OpcoesBrasao['movel'] }) {
  const paths = pathsMovel(id)
  if (!paths.length) return <span style={{ width: 28, height: 28, display: 'inline-block', borderRadius: 6, border: '1px dashed var(--line)' }} />
  return (
    <svg viewBox="0 0 100 100" width={28} height={28} fill="none" stroke={OURO} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

function Seg<T extends string>({ itens, valor, aoMudar, colunas }: { itens: Array<{ id: T; nome: string }>; valor: T; aoMudar: (v: T) => void; colunas?: number }) {
  return (
    <div className="seg" style={{ gridTemplateColumns: `repeat(${colunas ?? itens.length}, 1fr)` }}>
      {itens.map((i) => <button key={i.id} type="button" aria-pressed={valor === i.id} onClick={() => aoMudar(i.id)}>{i.nome}</button>)}
    </div>
  )
}

function Esmalte({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (hex: string) => void }) {
  return (
    <Campo rotulo={rotulo}>
      <div className="flex flex-wrap" role="radiogroup" aria-label={rotulo}>
        {ESMALTES.map((e) => (
          <button key={e.hex} type="button" role="radio" aria-checked={valor === e.hex} aria-label={e.nome} title={e.nome} onClick={() => aoMudar(e.hex)} style={{ width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: e.hex, border: `1.5px solid ${OURO}`, boxShadow: valor === e.hex ? '0 0 0 2px var(--card), 0 0 0 4px var(--text)' : 'none' }} />
          </button>
        ))}
      </div>
    </Campo>
  )
}

export default function Brasao() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const nav = useNavigate()
  const { rodar, ocupado } = useAcao()
  const [o, setO] = useState<OpcoesBrasao>(lerRascunho)
  const svg = useMemo(() => gerarBrasaoSvg(o), [o])
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  useEffect(() => { try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(o)) } catch { /* sem armazenamento */ } }, [o])

  const usar = () => rodar(async () => {
    const r = await api<{ url_brasao: string }>('salvar_brasao_svg', { svg })
    atualizarConfig({ url_brasao: r.url_brasao })
    nav('/configuracoes/identidade')
  }, 'Brasão da família atualizado.')
  const baixarSvg = () => baixarArquivo(svg, 'brasao-familia.svg', 'image/svg+xml')
  const baixarPng = () => rodar(async () => baixarArquivo(await svgParaPng(svg, 512), 'brasao-512.png'))
  const baixarIcones = () => rodar(async () => {
    baixarArquivo(await svgParaPng(svg, 192), 'icone-192.png')
    await new Promise((r) => setTimeout(r, 400))
    baixarArquivo(await svgParaPng(svg, 512), 'icone-512.png')
  }, 'Ícones 192 e 512 baixados.')

  return (
    <>
      <Cabecalho titulo="Brasão da família" subtitulo="Construtor heráldico clássico: traço dourado sobre azul-noite." voltarPara="/configuracoes/identidade" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="card lg:sticky" style={{ top: 16 }}>
          <h3>Prévia <span className="sub">SVG 512×512</span></h3>
          <div style={{ display: 'grid', placeItems: 'center', padding: 8 }}>
            <img src={svgParaDataUrl(svg)} alt="Prévia do brasão" style={{ width: '100%', maxWidth: 320, aspectRatio: '1', borderRadius: o.fundo === 'circulo' ? '50%' : 70 }} />
          </div>
          <div className="flex items-center justify-center gap-4 mt-2" aria-label="Como fica em tamanhos pequenos">
            {[46, 38, 28].map((t) => <span key={t} className="crest" style={{ width: t, height: t }}><img src={svgParaDataUrl(svg)} alt="" /></span>)}
            <small style={{ color: 'var(--muted)', fontSize: 11.5 }}>barra lateral, cabeçalho e ícone</small>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <button className="btn btn-primary btn-block" disabled={ocupado || !ehAdmin} onClick={usar} title={ehAdmin ? '' : 'Só o administrador troca o brasão'}><Icone nome="shield-check" />Usar como brasão da família</button>
            {!ehAdmin && <small style={{ color: 'var(--muted)', fontSize: 11.5, textAlign: 'center' }}>Só o administrador troca o brasão; você pode baixar o seu.</small>}
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={baixarSvg}><Icone nome="download" />SVG</button>
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={ocupado} onClick={baixarPng}><Icone nome="image" />PNG 512</button>
              <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={ocupado} onClick={baixarIcones}><Icone nome="smartphone" />Ícones</button>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => setO(OPCOES_PADRAO)}><Icone nome="undo-2" />Restaurar o padrão</button>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="card">
            <h3>Escudo <span className="sub">formato, esmaltes e partição</span></h3>
            <Campo rotulo="Formato do escudo"><Seg itens={FORMATOS} valor={o.escudo} aoMudar={(escudo) => setO({ ...o, escudo })} /></Campo>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Esmalte rotulo="Esmalte do campo" valor={o.esmalte1} aoMudar={(esmalte1) => setO({ ...o, esmalte1 })} />
              <Esmalte rotulo="Segundo esmalte (partição)" valor={o.esmalte2} aoMudar={(esmalte2) => setO({ ...o, esmalte2 })} />
            </div>
            <Campo rotulo="Partição" ajuda="Pleno: um só campo. Partido: dividido ao meio na vertical. Cortado: na horizontal. Esquartelado: quatro quartéis. Chevron: ponta invertida.">
              <Seg itens={PARTICOES} valor={o.particao} aoMudar={(particao) => setO({ ...o, particao })} colunas={5} />
            </Campo>
          </div>

          <div className="card">
            <h3>Móvel e iniciais <span className="sub">um símbolo, até 3 letras</span></h3>
            <Campo rotulo="Móvel">
              <div className="chips">
                {MOVEIS.map((m) => (
                  <button key={m.id} type="button" className="chip" aria-pressed={o.movel === m.id} onClick={() => setO({ ...o, movel: m.id })}><MiniMovel id={m.id} />{m.nome}</button>
                ))}
              </div>
            </Campo>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Campo rotulo="Iniciais (serifadas, douradas)" ajuda="Com um móvel, as letras ficam no chefe (parte de cima).">
                <input className="campo" value={o.iniciais} maxLength={3} onChange={(e) => setO({ ...o, iniciais: e.target.value.replace(/[^\p{L}]/gu, '').toUpperCase().slice(0, 3) })} placeholder="LNR" style={{ letterSpacing: 6, fontFamily: 'Georgia, serif', textTransform: 'uppercase' }} />
              </Campo>
              <Campo rotulo="Ano de fundação (opcional)">
                <input className="campo num" value={o.ano} maxLength={12} inputMode="numeric" onChange={(e) => setO({ ...o, ano: e.target.value.replace(/[^\d.\-–A-Za-z ]/g, '').slice(0, 12) })} placeholder="2012" />
              </Campo>
            </div>
          </div>

          <div className="card">
            <h3>Listel <span className="sub">mote da família</span></h3>
            <Campo rotulo="Mote" ajuda="Deixe vazio para não desenhar o listel.">
              <input className="campo" value={o.mote} maxLength={48} onChange={(e) => setO({ ...o, mote: e.target.value })} placeholder="Josué 24.15" />
            </Campo>
            <div className="flex flex-wrap gap-2 mb-2">
              {MOTES.map((m) => <button key={m} type="button" className="chip" style={{ width: 'auto' }} aria-pressed={o.mote === m} onClick={() => setO({ ...o, mote: m })}>{m}</button>)}
            </div>
          </div>

          <div className="card">
            <h3>Acabamento</h3>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Campo rotulo="Fundo"><Seg itens={[{ id: 'circulo' as const, nome: 'Círculo' }, { id: 'quadrado' as const, nome: 'Quadrado arredondado' }]} valor={o.fundo} aoMudar={(fundo) => setO({ ...o, fundo })} /></Campo>
              <Campo rotulo="Traço" ajuda="Mais forte fica legível no ícone pequeno.">
                <Seg itens={[{ id: '4', nome: 'Fino' }, { id: '6', nome: 'Médio' }, { id: '8', nome: 'Forte' }]} valor={String(o.traco) as '4' | '6' | '8'} aoMudar={(t) => setO({ ...o, traco: Number(t) })} />
              </Campo>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0 }}>O rascunho fica guardado neste aparelho. Ao usar como brasão, o servidor também gera os ícones 192 e 512 px do app.</p>
          </div>
        </div>
      </div>
    </>
  )
}
