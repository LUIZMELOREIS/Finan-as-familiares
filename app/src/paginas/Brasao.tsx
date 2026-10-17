import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { useBoot, useSessao } from '../store/sessao'
import { api } from '../api/cliente'
import { DIVISOES, FORMATOS, MOTES_RAPIDOS, OPCOES_PADRAO, SIMBOLOS, gerarBrasaoSvg, svgParaDataUrl, type OpcoesBrasao } from '../componentes/brasao/gerador'
import { PALETA, baixarArquivo, Campo } from '../componentes/config/comuns'

const CHAVE_RASCUNHO = 'ff_brasao_rascunho'

function lerRascunho(iniciaisPadrao: string): OpcoesBrasao {
  try {
    const s = localStorage.getItem(CHAVE_RASCUNHO)
    if (s) return { ...OPCOES_PADRAO, ...JSON.parse(s) }
  } catch { /* sem rascunho */ }
  return { ...OPCOES_PADRAO, iniciais: iniciaisPadrao }
}

/** Iniciais a partir do sobrenome: "Melo Reis" → "MR". */
function iniciaisDe(sobrenome: string, nomeFamilia: string): string {
  const base = (sobrenome || nomeFamilia.replace(/^fam[ií]lia\s+/i, '')).trim()
  const partes = base.split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p)).filter((p) => !/^(de|da|do|dos|das|e)$/i.test(p))
  return partes.map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 3) || 'F'
}

function CorEscolha({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (c: string) => void }) {
  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex flex-wrap gap-2 items-center">
        {PALETA.map((c) => (
          <button key={c} type="button" onClick={() => aoMudar(c)} aria-label={`${rotulo}: ${c}`} aria-pressed={valor === c} className="w-11 h-11 rounded-full border-4" style={{ background: c, borderColor: valor.toLowerCase() === c.toLowerCase() ? 'var(--texto)' : 'transparent' }} />
        ))}
        <label className="w-11 h-11 rounded-full border-2 border-dashed border-borda flex items-center justify-center cursor-pointer relative" title="Outra cor">
          <span aria-hidden>🎨</span>
          <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={`${rotulo}: outra cor`} />
        </label>
      </div>
    </div>
  )
}

export default function Brasao() {
  const boot = useBoot()
  const nav = useNavigate()
  const avisar = useSessao((e) => e.avisar)
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const [o, setO] = useState<OpcoesBrasao>(() => lerRascunho(iniciaisDe(boot.config.sobrenome, boot.config.nome_familia)))
  const [salvando, setSalvando] = useState(false)

  const svg = useMemo(() => gerarBrasaoSvg(o), [o])
  const dataUrl = useMemo(() => svgParaDataUrl(svg), [svg])

  function mudar<K extends keyof OpcoesBrasao>(campo: K, valor: OpcoesBrasao[K]) {
    const novo = { ...o, [campo]: valor }
    setO(novo)
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(novo)) } catch { /* ignora */ }
  }

  async function salvar() {
    setSalvando(true)
    try {
      const r = await api<{ url_brasao: string }>('salvar_brasao_svg', { svg })
      atualizarConfig({ url_brasao: r.url_brasao })
      avisar('Brasão salvo! Ele já aparece na capa da família. ✅', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  function baixarSvg() {
    baixarArquivo(`brasao-${o.iniciais || 'familia'}.svg`, svg, 'image/svg+xml;charset=utf-8')
  }

  async function baixarPng() {
    try {
      const img = new Image()
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Não foi possível desenhar o brasão'))
        img.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponível')
      ctx.drawImage(img, 0, 0, 512, 512)
      URL.revokeObjectURL(url)
      const png = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = png
      a.download = `brasao-${o.iniciais || 'familia'}-512.png`
      a.click()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Erro ao gerar PNG', { tipo: 'erro' })
    }
  }

  return (
    <>
      <Cabecalho titulo="Brasão da família" voltarPara="/configuracoes/identidade" />
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {/* Prévia */}
        <div className="card p-4 flex flex-col items-center gap-2">
          <img src={dataUrl} alt="Prévia do brasão" className="w-64 h-64 max-w-full drop-shadow-xl" />
          <p className="text-sm text-suave text-center">A prévia muda na hora. Quando gostar, salve como brasão da família.</p>
        </div>

        {/* Formato */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo-secao">Escudo</h2>
          <div className="grid grid-cols-3 gap-2">
            {FORMATOS.map((f) => (
              <button key={f.id} className={`botao !px-2 ${o.formato === f.id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => mudar('formato', f.id)} aria-pressed={o.formato === f.id}>
                <span aria-hidden>{f.id === 'redondo' ? '⚪' : f.id === 'frances' ? '🛡️' : '🔰'}</span> {f.nome}
              </button>
            ))}
          </div>
          <div>
            <span className="rotulo">Divisão</span>
            <div className="grid grid-cols-2 gap-2">
              {DIVISOES.map((d) => (
                <button key={d.id} className={`botao flex-col !gap-0 !py-2 ${o.divisao === d.id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => mudar('divisao', d.id)} aria-pressed={o.divisao === d.id}>
                  <span>{d.nome}</span>
                  <span className="text-xs opacity-80 font-normal">{d.dica}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Cores */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo-secao">Cores</h2>
          <CorEscolha rotulo="Cor principal" valor={o.cor1} aoMudar={(c) => mudar('cor1', c)} />
          {o.divisao !== 'liso' && <CorEscolha rotulo="Segunda cor" valor={o.cor2} aoMudar={(c) => mudar('cor2', c)} />}
        </section>

        {/* Símbolo */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo-secao">Símbolo central (em dourado)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SIMBOLOS.map((s) => (
              <button key={s.id} className={`botao flex-col !gap-0 !py-2 !h-auto ${o.simbolo === s.id ? 'botao-primario' : 'botao-secundario'}`} onClick={() => mudar('simbolo', s.id)} aria-pressed={o.simbolo === s.id}>
                <span>{s.nome}</span>
                {s.significado && <span className="text-xs opacity-80 font-normal">{s.significado}</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Textos */}
        <section className="card p-4 space-y-3">
          <h2 className="titulo-secao">Letras</h2>
          <Campo rotulo="Iniciais da família (1 a 3 letras)">
            <input className="campo uppercase" maxLength={3} value={o.iniciais} onChange={(e) => mudar('iniciais', e.target.value.replace(/[^\p{L}]/gu, '').slice(0, 3))} placeholder="MR" />
          </Campo>
          <Campo rotulo="Mote (na faixa de baixo)">
            <input className="campo" maxLength={48} value={o.mote} onChange={(e) => mudar('mote', e.target.value)} placeholder="Js 24:15" />
          </Campo>
          <div className="flex flex-wrap gap-2">
            {MOTES_RAPIDOS.map((m) => (
              <button key={m} className="botao botao-secundario !min-h-11 text-sm" onClick={() => mudar('mote', m)}>“{m}”</button>
            ))}
          </div>
          <Campo rotulo="Ano de fundação (casamento) — opcional">
            <input className="campo" inputMode="numeric" maxLength={4} value={o.ano} onChange={(e) => mudar('ano', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2008" />
          </Campo>
        </section>

        {/* Ações */}
        <section className="card p-4 space-y-3">
          {ehAdmin ? (
            <button className="botao botao-primario w-full !min-h-14 text-lg" onClick={salvar} disabled={salvando}>
              {salvando ? '⏳ Salvando…' : '🏡 Salvar como brasão da família'}
            </button>
          ) : (
            <p className="text-sm text-suave">Só um Administrador pode salvar o brasão da família. Você pode baixar o desenho e enviar para ele.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="botao botao-secundario" onClick={baixarSvg}>⬇️ Baixar SVG</button>
            <button className="botao botao-secundario" onClick={baixarPng}>🖼️ Baixar PNG 512</button>
          </div>
          <p className="text-sm text-suave">
            O brasão aparece na capa do app e também vira o <strong>ícone do aplicativo</strong>. O ícone na tela do celular muda na
            próxima vez que o app for instalado ("Adicionar à Tela de Início").
          </p>
          <button className="botao botao-fantasma w-full" onClick={() => nav('/configuracoes/identidade')}>Voltar para Identidade da Família</button>
        </section>
      </div>
    </>
  )
}
