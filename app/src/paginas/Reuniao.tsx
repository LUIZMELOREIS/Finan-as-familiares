import { useEffect, useMemo, useState } from 'react'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando } from '../componentes/Carregando'
import { SeletorMes } from '../componentes/familia/SeletorMes'
import { Blocos } from '../componentes/familia/Markdown'
import { dividirSecoes, formatarNumerosBr, iconeDaSecao, markdownParaTexto } from '../componentes/familia/markdown'
import { competenciaReuniaoPadrao } from '../componentes/familia/calculos'
import { api } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import { competenciaDe, dataBr, hojeIso, nomeCompetencia } from '../util/formato'
import type { Reuniao as TipoReuniao } from '../tipos'

const CHAVE_HISTORICO = 'ff_reunioes_salvas'
interface ItemHistorico { competencia: string; data: string }

function lerHistorico(): ItemHistorico[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || '[]') as ItemHistorico[] } catch { return [] }
}
function guardarHistorico(itens: ItemHistorico[]) {
  try { localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(itens)) } catch { /* sem armazenamento — segue */ }
}

/** Estilos só para impressão: esconde a navegação e mostra a pauta limpa (salvar como PDF no celular). */
const ESTILO_IMPRESSAO = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; color: #111 !important; font-size: 12pt; }
  nav, aside, header, .fab, .aviso, .nao-imprimir { display: none !important; }
  main { padding: 0 !important; }
  .card { box-shadow: none !important; border: 1px solid #ccc !important; background: #fff !important; color: #111 !important; break-inside: avoid; }
  .text-suave { color: #444 !important; }
  .so-impressao { display: block !important; }
  textarea.campo { border: 1px solid #ccc !important; background: #fff !important; color: #111 !important; }
}
.so-impressao { display: none; }
`

export default function Reuniao() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const hoje = hojeIso()
  const [competencia, setCompetencia] = useState(() => competenciaReuniaoPadrao(hoje))
  const [reuniao, setReuniao] = useState<TipoReuniao | null>(null)
  const [decidido, setDecidido] = useState('')
  const [oracao, setOracao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState<ItemHistorico[]>(lerHistorico)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    api<TipoReuniao>('pauta_reuniao', { competencia })
      .then((r) => {
        if (!vivo) return
        setReuniao(r)
        setDecidido(r.decidido || '')
        setOracao(r.oracao_gratidao || '')
      })
      .catch((e) => avisar(e instanceof Error ? e.message : 'Não foi possível montar a pauta', { tipo: 'erro' }))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [competencia, avisar])

  const pauta = useMemo(() => dividirSecoes(formatarNumerosBr(reuniao?.pauta ?? '')), [reuniao])
  // As seções 7 e 8 são preenchidas nos campos abaixo — não repetimos o "(preencher)".
  const secoesVisiveis = pauta.secoes.filter((s) => !/^(7|8)\./.test(s.titulo))
  const jaSalva = historico.some((h) => h.competencia === competencia)

  const salvar = async () => {
    if (!reuniao) return
    setSalvando(true)
    try {
      const r = await api<TipoReuniao>('salvar_reuniao', { reuniao: { ...reuniao, data: reuniao.data || hoje, decidido: decidido.trim(), oracao_gratidao: oracao.trim(), criado_por: reuniao.criado_por || boot.usuario.id } })
      setReuniao(r)
      const novo = [{ competencia, data: hoje }, ...historico.filter((h) => h.competencia !== competencia)].sort((a, b) => (a.competencia < b.competencia ? 1 : -1))
      setHistorico(novo)
      guardarHistorico(novo)
      avisar('Ata salva. Que bom reunir a família!', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar a ata', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  const textoCompleto = () => {
    const partes = [markdownParaTexto(formatarNumerosBr(reuniao?.pauta ?? ''))]
    if (decidido.trim()) partes.push('', 'O QUE DECIDIMOS', decidido.trim())
    if (oracao.trim()) partes.push('', 'MOTIVO DE ORAÇÃO E GRATIDÃO', oracao.trim())
    return partes.join('\n')
  }

  const compartilhar = async () => {
    const texto = textoCompleto()
    if (navigator.share) {
      try { await navigator.share({ title: `Reunião da família — ${nomeCompetencia(competencia)}`, text: texto }) } catch { /* cancelado */ }
      return
    }
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Pauta copiada. Cole no WhatsApp da família.', { tipo: 'ok' })
    } catch {
      avisar('Seu celular não permite compartilhar daqui. Use "Exportar em PDF".', { tipo: 'erro' })
    }
  }

  return (
    <>
      <style>{ESTILO_IMPRESSAO}</style>
      <Cabecalho titulo="Reunião da Família" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="nao-imprimir"><SeletorMes competencia={competencia} aoMudar={setCompetencia} maxima={competenciaDe()} /></div>

        <div className="so-impressao">
          <h1 className="text-2xl font-extrabold">{boot.config.nome_familia} — Reunião de {nomeCompetencia(competencia)}</h1>
          <p className="text-suave">Gerado em {dataBr(hoje)}</p>
        </div>

        {carregando || !reuniao ? (
          <Carregando texto="Montando a pauta…" />
        ) : (
          <>
            <div className="card p-4 flex items-center gap-3">
              <span className="text-3xl" aria-hidden>👨‍👩‍👧‍👦</span>
              <div className="flex-1">
                <div className="font-bold text-lg leading-tight">{pauta.titulo || `Reunião da Família — ${nomeCompetencia(competencia)}`}</div>
                <div className="text-sm text-suave">{jaSalva ? `Ata salva em ${dataBr(historico.find((h) => h.competencia === competencia)?.data)}` : 'Pauta montada automaticamente com os números do mês.'}</div>
              </div>
            </div>

            {secoesVisiveis.map((s, i) => (
              <section key={i} className="card p-4">
                {s.titulo && (
                  <h2 className="font-bold text-lg flex items-center gap-2 mb-2">
                    <span className="text-2xl" aria-hidden>{iconeDaSecao(s.titulo)}</span>
                    <span>{s.titulo.replace(/^\d+\.\s*/, '')}</span>
                  </h2>
                )}
                <Blocos blocos={s.blocos} />
              </section>
            ))}

            <section className="card p-4">
              <label className="block">
                <h2 className="font-bold text-lg flex items-center gap-2 mb-2"><span className="text-2xl" aria-hidden>✍️</span> O que decidimos</h2>
                <textarea className="campo min-h-32" value={decidido} onChange={(e) => setDecidido(e.target.value)} placeholder="Ex.: Menos delivery; a diferença vai para Gramado." />
              </label>
            </section>
            <section className="card p-4">
              <label className="block">
                <h2 className="font-bold text-lg flex items-center gap-2 mb-2"><span className="text-2xl" aria-hidden>🙏</span> Motivo de oração e gratidão</h2>
                <textarea className="campo min-h-32" value={oracao} onChange={(e) => setOracao(e.target.value)} placeholder="Ex.: Gratidão pelo emprego novo; oração pela saúde do vovô." />
              </label>
            </section>

            <div className="nao-imprimir space-y-2">
              <button className="botao botao-primario w-full text-lg !min-h-14" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar ata'}</button>
              <div className="grid grid-cols-2 gap-2">
                <button className="botao botao-secundario" onClick={() => window.print()}>🖨️ Exportar em PDF</button>
                <button className="botao botao-secundario" onClick={compartilhar}>📤 Compartilhar</button>
              </div>
            </div>

            {historico.length > 0 && (
              <section className="card p-4 nao-imprimir">
                <h2 className="titulo-secao mb-2">Reuniões registradas</h2>
                <ul className="divide-y divide-borda">
                  {historico.map((h) => (
                    <li key={h.competencia}>
                      <button className="w-full flex items-center justify-between py-3 text-left min-h-12" onClick={() => setCompetencia(h.competencia)}>
                        <span className="font-semibold">📖 {nomeCompetencia(h.competencia)}</span>
                        <span className="text-sm text-suave">salva em {dataBr(h.data)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
