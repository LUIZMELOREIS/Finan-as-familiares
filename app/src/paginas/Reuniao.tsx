/**
 * Reunião da família (/reuniao): pauta automática do mês em cards por seção,
 * "O que decidimos" e "Motivo de gratidão" editáveis (ata), projeção dos próximos
 * 3 meses, histórico das atas, impressão/PDF e compartilhamento.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/cliente'
import { Avatar } from '../componentes/Avatar'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando } from '../componentes/Carregando'
import { Icone } from '../componentes/Icone'
import { AcaoCelular, AcoesTopbar } from '../componentes/familia/AcaoCelular'
import { Blocos } from '../componentes/familia/Markdown'
import { competenciaReuniao } from '../componentes/familia/calculos'
import { converterMarkdown, markdownParaTexto, secaoVazia, type Secao } from '../componentes/familia/markdown'
import { useBoot, useSessao, usuarioPorId } from '../store/sessao'
import type { Reuniao as TipoReuniao } from '../tipos'
import { competenciaDe, dataBr, hojeIso, moeda, nomeCompetencia, somarMeses } from '../util/formato'

const ICONE_SECAO: Record<number, string> = { 1: 'trending-up', 2: 'triangle-alert', 3: 'receipt', 4: 'target', 5: 'vote', 6: 'book-open', 7: 'pencil', 8: 'hand-heart' }
interface Projecao { competencia: string; receitas: number; despesas: number; saldo: number }

export default function Reuniao() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [comp, setComp] = useState(() => competenciaReuniao())
  const [reuniao, setReuniao] = useState<TipoReuniao | null>(null)
  const [decidido, setDecidido] = useState('')
  const [gratidao, setGratidao] = useState('')
  const [projecao, setProjecao] = useState<Projecao[]>([])
  const [historico, setHistorico] = useState<TipoReuniao[]>([])
  const [salvando, setSalvando] = useState(false)
  const ehDependente = boot.usuario.perfil === 'Dependente'

  const meses = useMemo(() => Array.from({ length: 12 }, (_, i) => somarMeses(competenciaDe(), -i)), [])

  const carregar = useCallback(async () => {
    setReuniao(null)
    try {
      const [r, rel, hist] = await Promise.all([
        api<TipoReuniao>('pauta_reuniao', { competencia: comp }),
        api<{ markdown: string; projecao: Projecao[] }>('relatorio_mensal', { competencia: comp }).catch(() => ({ markdown: '', projecao: [] as Projecao[] })),
        api<TipoReuniao[]>('listar_reunioes').catch(() => [] as TipoReuniao[]),
      ])
      setReuniao(r); setDecidido(r.decidido || ''); setGratidao(r.oracao_gratidao || '')
      setProjecao(rel.projecao ?? []); setHistorico(hist)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível montar a pauta.', { tipo: 'erro' })
      setReuniao({ id: '', competencia: comp, data: hojeIso(), pauta: '', decidido: '', oracao_gratidao: '', criado_por: boot.usuario.id })
    }
  }, [comp, avisar, boot.usuario.id])
  useEffect(() => { carregar() }, [carregar])

  const secoes = useMemo(() => (reuniao ? converterMarkdown(reuniao.pauta) : []), [reuniao])
  const automaticas = secoes.filter((s) => s.nivel === 2 && (s.numero === undefined || s.numero <= 6))
  const salvaEm = historico.find((h) => h.competencia === comp)
  const mudou = !!reuniao && (decidido !== (reuniao.decidido || '') || gratidao !== (reuniao.oracao_gratidao || ''))

  const salvar = async () => {
    if (!reuniao || salvando) return
    setSalvando(true)
    try {
      const salvo = await api<TipoReuniao>('salvar_reuniao', { reuniao: { ...reuniao, data: reuniao.data || hojeIso(), decidido: decidido.trim(), oracao_gratidao: gratidao.trim(), criado_por: reuniao.criado_por || boot.usuario.id } })
      setReuniao(salvo)
      setHistorico((h) => [salvo, ...h.filter((x) => x.competencia !== salvo.competencia)].sort((a, b) => b.competencia.localeCompare(a.competencia)))
      avisar('Ata salva.', { tipo: 'ok' })
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível salvar a ata.', { tipo: 'erro' }) } finally { setSalvando(false) }
  }

  const textoCompleto = () => {
    const base = reuniao ? markdownParaTexto(reuniao.pauta.replace(/## 7\.[\s\S]*$/, '')) : ''
    return `${base}\n\n7. O QUE DECIDIMOS\n${decidido.trim() || '—'}\n\n8. MOTIVO DE GRATIDÃO\n${gratidao.trim() || '—'}`.trim()
  }
  const compartilhar = async () => {
    const texto = textoCompleto()
    const titulo = `Reunião da família — ${nomeCompetencia(comp)}`
    try {
      if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return }
      await navigator.clipboard.writeText(`${titulo}\n\n${texto}`)
      avisar('Pauta copiada. Cole no grupo da família.', { tipo: 'ok' })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      avisar('Não foi possível compartilhar neste aparelho.', { tipo: 'erro' })
    }
  }

  return (
    <>
      <Cabecalho titulo="Reunião da família" subtitulo="Pauta automática do mês, decisões e gratidão."
        acoes={<AcoesTopbar>
          <button className="btn btn-ghost" onClick={() => window.print()}><Icone nome="printer" />Imprimir / PDF</button>
          <button className="btn btn-primary" onClick={compartilhar}><Icone nome="share-2" />Compartilhar</button>
        </AcoesTopbar>} />

      <div className="flex items-center gap-3 flex-wrap nao-imprimir" style={{ marginBottom: 14 }}>
        <label className="rotulo" htmlFor="reuniao-mes">Mês da reunião</label>
        <select id="reuniao-mes" className="campo" style={{ width: 'auto', minWidth: 200 }} value={comp} onChange={(e) => setComp(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{nomeCompetencia(m)}{historico.some((h) => h.competencia === m) ? ' · ata salva' : ''}</option>)}
        </select>
        {salvaEm && <span className="tag ok">Ata salva em {dataBr(salvaEm.data)}</span>}
      </div>

      <h2 className="sr-only">Reunião da família — {nomeCompetencia(comp)}</h2>

      {!reuniao ? <Carregando texto="Montando a pauta…" /> : (
        <div className="grid gap-3.5 lg:grid-cols-2 items-start">
          {automaticas.map((s, i) => <CardSecao key={`${s.numero ?? 'x'}-${i}`} secao={s} />)}

          <section className="card" aria-labelledby="sec-7">
            <h3 id="sec-7"><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ico-sm"><Icone nome={ICONE_SECAO[7]} /></span>7. O que decidimos</span></h3>
            <textarea className="campo" rows={4} value={decidido} onChange={(e) => setDecidido(e.target.value)} placeholder="Ex.: Reduzir delivery para R$ 250 em novembro; aprovar a troca do carro a partir de janeiro." aria-label="O que decidimos" readOnly={ehDependente} />
          </section>
          <section className="card" aria-labelledby="sec-8">
            <h3 id="sec-8"><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ico-sm"><Icone nome={ICONE_SECAO[8]} /></span>8. Motivo de gratidão</span></h3>
            <textarea className="campo" rows={4} value={gratidao} onChange={(e) => setGratidao(e.target.value)} placeholder="Ex.: A saúde de todos e o mês fechado no azul." aria-label="Motivo de gratidão" readOnly={ehDependente} />
            {!ehDependente && (
              <div className="flex justify-end nao-imprimir" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando || !mudou}><Icone nome="check" />{salvando ? 'Salvando…' : salvaEm ? 'Atualizar ata' : 'Salvar ata'}</button>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="proj-t">
            <h3 id="proj-t"><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ico-sm"><Icone nome="calendar" /></span>Projeção dos próximos 3 meses</span></h3>
            {projecao.length === 0 ? <p className="sub" style={{ margin: 0 }}>Sem dados para projetar.</p> : (
              <table className="num" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ color: 'var(--muted)', fontSize: 11.5, textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 400, padding: '4px 0' }}>Mês</th><th style={{ fontWeight: 400 }}>Receitas</th><th style={{ fontWeight: 400 }}>Despesas</th><th style={{ fontWeight: 400 }}>Saldo</th></tr></thead>
                <tbody>
                  {projecao.map((p) => (
                    <tr key={p.competencia} style={{ borderTop: '1px solid var(--line)', textAlign: 'right' }}>
                      <td style={{ textAlign: 'left', padding: '8px 0' }}>{nomeCompetencia(p.competencia, true)}</td>
                      <td>{moeda(p.receitas)}</td><td>{moeda(p.despesas)}</td>
                      <td style={{ fontWeight: 600, color: p.saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{moeda(p.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="sub" style={{ margin: '8px 0 0' }}>Estimativa com o orçamento e as contas recorrentes; serve para conversar, não para prometer.</p>
          </section>

          <section className="card nao-imprimir" aria-labelledby="hist-t">
            <h3 id="hist-t"><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ico-sm"><Icone nome="book-marked" /></span>Histórico de atas</span></h3>
            {historico.length === 0 ? <p className="sub" style={{ margin: 0 }}>Nenhuma ata salva ainda. A primeira reunião pode ser curta: 20 minutos bastam.</p> : (
              <div className="rows">
                {historico.map((h) => (
                  <button className="row" key={h.id || h.competencia} onClick={() => setComp(h.competencia)} aria-current={h.competencia === comp ? 'true' : undefined} style={{ minHeight: 44 }}>
                    <Avatar usuario={usuarioPorId(boot.usuarios, h.criado_por)} tamanho={30} />
                    <div className="t"><b>{nomeCompetencia(h.competencia)}</b><small>{h.decidido ? h.decidido.slice(0, 90) : 'Sem decisões anotadas'}{h.decidido && h.decidido.length > 90 ? '…' : ''}</small></div>
                    <small className="num" style={{ color: 'var(--muted)' }}>{dataBr(h.data)}</small>
                    <Icone nome="chevron-right" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {reuniao && (
        <AcaoCelular>
          <button className="btn btn-primary btn-block" onClick={compartilhar}><Icone nome="share-2" />Compartilhar</button>
          <button className="btn btn-ghost btn-block" onClick={() => window.print()}><Icone nome="printer" />Imprimir / PDF</button>
        </AcaoCelular>
      )}
    </>
  )
}

function CardSecao({ secao: s }: { secao: Secao }) {
  const vazia = secaoVazia(s)
  return (
    <section className="card" aria-labelledby={`sec-${s.numero ?? s.titulo}`}>
      <h3 id={`sec-${s.numero ?? s.titulo}`}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ico-sm"><Icone nome={ICONE_SECAO[s.numero ?? 0] ?? 'file-text'} /></span>{s.numero ? `${s.numero}. ` : ''}{s.titulo}</span></h3>
      {vazia ? <p className="sub" style={{ margin: 0 }}>Nada a registrar.</p> : <Blocos blocos={s.blocos} />}
    </section>
  )
}
