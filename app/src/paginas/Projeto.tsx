import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Confete } from '../componentes/Confete'
import { Avatar } from '../componentes/familia/Avatar'
import { Termometro } from '../componentes/familia/Termometro'
import { GraficoEvolucao } from '../componentes/familia/GraficoEvolucao'
import { FolhaAporte } from '../componentes/familia/FolhaAporte'
import { FormularioProjeto } from '../componentes/familia/FormularioProjeto'
import { calcularRitmo, evolucaoAcumulada, marcoCruzado, simularCorte } from '../componentes/familia/calculos'
import { FILIPENSES_4_19, versiculoPorReferencia } from '../componentes/familia/versiculos'
import { api } from '../api/cliente'
import { useBoot, useSessao, usuarioPorId } from '../store/sessao'
import { dataBr, hojeIso, moeda, nomeCompetencia } from '../util/formato'
import type { Aporte, Projeto as TipoProjeto } from '../tipos'

export default function Projeto() {
  const { id } = useParams()
  const nav = useNavigate()
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarProjetos = useSessao((e) => e.atualizarProjetos)
  const [projeto, setProjeto] = useState<TipoProjeto | null>(boot.projetos.find((p) => p.id === id) ?? null)
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aporteAberto, setAporteAberto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [celebrando, setCelebrando] = useState(false)
  const [mensagemMarco, setMensagemMarco] = useState<string | null>(null)
  const [corte, setCorte] = useState(200)
  const ehAdmin = boot.usuario.perfil === 'Administrador'
  const hoje = hojeIso()

  const recarregar = useCallback(async () => {
    const [ps, as] = await Promise.all([api<TipoProjeto[]>('listar_projetos'), api<Aporte[]>('listar_aportes', { projeto_id: id })])
    atualizarProjetos(ps)
    setProjeto(ps.find((p) => p.id === id) ?? null)
    setAportes(as)
    return ps.find((p) => p.id === id) ?? null
  }, [id, atualizarProjetos])

  useEffect(() => {
    let vivo = true
    recarregar()
      .catch((e) => avisar(e instanceof Error ? e.message : 'Não foi possível carregar o sonho', { tipo: 'erro' }))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [recarregar, avisar])

  const ritmo = useMemo(() => (projeto ? calcularRitmo(projeto, aportes, hoje) : null), [projeto, aportes, hoje])
  const evolucao = useMemo(() => {
    if (!projeto) return []
    const primeiro = [projeto.criado_em.slice(0, 7), ...aportes.map((a) => a.data.slice(0, 7))].sort()[0]
    return evolucaoAcumulada(aportes, projeto.valor_inicial, primeiro, hoje.slice(0, 7))
  }, [projeto, aportes, hoje])
  const simulacao = useMemo(() => (ritmo ? simularCorte(ritmo.faltam, ritmo.ritmoAtual, corte, hoje) : null), [ritmo, corte, hoje])

  if (carregando && !projeto) return <><Cabecalho titulo="Sonho" voltarPara="/sonhos" /><Carregando texto="Abrindo o sonho…" /></>
  if (!projeto || !ritmo) {
    return (
      <>
        <Cabecalho titulo="Sonho" voltarPara="/sonhos" />
        <div className="max-w-3xl mx-auto p-4"><Vazio icone="🔎" titulo="Sonho não encontrado"><Link to="/sonhos" className="botao botao-primario">✈️ Ver todos os sonhos</Link></Vazio></div>
      </>
    )
  }

  const atual = projeto.valor_atual ?? projeto.valor_inicial
  const versiculo = versiculoPorReferencia(projeto.versiculo)
  const feAtiva = boot.config.fe_ativa
  const filipenses = versiculoPorReferencia(FILIPENSES_4_19)

  const aoAportado = async () => {
    const pctAntes = ritmo.pct
    const novo = await recarregar()
    const pctDepois = novo ? calcularRitmo(novo, [], hoje).pct : pctAntes
    const marco = marcoCruzado(pctAntes, pctDepois)
    if (marco) {
      setCelebrando(true)
      setTimeout(() => setCelebrando(false), 3800)
      setMensagemMarco(
        marco === 100
          ? `🎉 Meta alcançada! ${feAtiva && filipenses ? `“${filipenses.texto}” — ${filipenses.referencia}` : 'Parabéns, família!'}`
          : `🎊 Vocês passaram de ${marco}% do sonho! Continuem firmes.`,
      )
    } else {
      avisar('Aporte guardado. Cada passo conta!', { tipo: 'ok' })
    }
  }

  const mudarStatus = async (status: TipoProjeto['status'], aviso: string) => {
    try {
      await api('salvar_projeto', { projeto: { ...projeto, status } })
      await recarregar()
      avisar(aviso, { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível alterar', { tipo: 'erro' })
    }
  }

  const excluir = async () => {
    if (!window.confirm(`Pausar e arquivar o sonho "${projeto.nome}"? O histórico de aportes fica guardado.`)) return
    await mudarStatus('pausado', 'Sonho pausado e arquivado. O histórico continua guardado.')
    nav('/sonhos')
  }

  const podeAportar = projeto.status === 'ativo'
  const mesesTexto = (n: number | null) => (n === null ? 'sem previsão' : n === 0 ? 'já está lá' : n === 1 ? '1 mês' : `${n} meses`)

  return (
    <>
      <Cabecalho titulo={projeto.nome} voltarPara="/sonhos" />
      <Confete ativo={celebrando} />

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Capa */}
        <div className="card overflow-hidden">
          {projeto.foto_url ? (
            <img src={projeto.foto_url} alt="" className="w-full h-48 object-cover" />
          ) : (
            <div className="h-40 flex items-center justify-center text-7xl" style={{ background: 'linear-gradient(135deg, var(--laranja), var(--amarelo))' }} aria-hidden>{projeto.icone}</div>
          )}
          <div className="p-4">
            <h2 className="text-2xl font-extrabold leading-tight flex items-center gap-2"><span aria-hidden>{projeto.icone}</span>{projeto.nome}</h2>
            {feAtiva && versiculo && <p className="text-suave italic mt-2 leading-relaxed">“{versiculo.texto}” — {versiculo.referencia}</p>}
          </div>
        </div>

        {projeto.status === 'votação' && (
          <div className="card p-4 border-amarelo flex items-center gap-3">
            <span className="text-3xl" aria-hidden>🗳️</span>
            <div className="flex-1">
              <div className="font-bold">Este sonho está em votação no Conselho</div>
              <div className="text-sm text-suave">Os aportes começam depois que a família aprovar.</div>
            </div>
            <Link to="/conselho" className="botao botao-amarelo">Votar</Link>
          </div>
        )}
        {projeto.status === 'pausado' && (
          <div className="card p-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden>⏸️</span>
            <div className="flex-1 font-bold">Sonho pausado</div>
            {ehAdmin && <button className="botao botao-verde" onClick={() => mudarStatus('ativo', 'Sonho retomado!')}>▶️ Retomar</button>}
          </div>
        )}

        {mensagemMarco && (
          <div className="card p-4 border-verde bg-card pulsar" role="status">
            <p className="font-bold text-lg leading-snug">{mensagemMarco}</p>
            <button className="botao botao-fantasma mt-2" onClick={() => setMensagemMarco(null)}>✓ <span className="text-sm">Amém</span></button>
          </div>
        )}

        {/* Termômetro + números */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <Termometro pct={ritmo.pct} altura={240} />
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <div className="text-sm text-suave">Guardado</div>
                <div className="numero-grande text-verde">{moeda(atual)}</div>
              </div>
              <div>
                <div className="text-sm text-suave">Meta</div>
                <div className="text-xl font-bold">{moeda(projeto.meta_valor)}</div>
              </div>
              <div>
                <div className="text-sm text-suave">Falta</div>
                <div className="text-xl font-bold">{moeda(ritmo.faltam)}</div>
              </div>
            </div>
          </div>

          {projeto.status === 'concluído' || ritmo.concluido ? (
            <p className="mt-4 text-lg font-bold text-verde">🎉 Meta alcançada! Que alegria.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-lg leading-snug">
                Precisa guardar <strong>{moeda(ritmo.necessarioMes)} por mês</strong> para chegar em <strong>{dataBr(projeto.data_alvo)}</strong>
                {ritmo.meses > 0 ? ` (${ritmo.meses} ${ritmo.meses === 1 ? 'mês' : 'meses'}).` : '.'}
              </p>
              <p className={`font-bold ${ritmo.noRitmo ? 'text-verde' : 'text-amarelo'}`}>
                {ritmo.noRitmo ? '✅ No ritmo' : '⚠️ Um pouco atrasado'}
                <span className="font-normal text-suave"> — média dos últimos 3 meses: {moeda(ritmo.ritmoAtual)}/mês</span>
              </p>
            </div>
          )}
        </div>

        {podeAportar && (
          <button className="botao botao-verde w-full text-xl !min-h-16" onClick={() => setAporteAberto(true)}>💰 Fazer um aporte</button>
        )}

        {/* Gráfico */}
        <div className="card p-4">
          <h3 className="font-bold mb-1">Evolução do que foi guardado</h3>
          <p className="text-sm text-suave mb-3">Valor acumulado mês a mês · a linha tracejada é a meta</p>
          <GraficoEvolucao dados={evolucao} meta={projeto.meta_valor} />
        </div>

        {/* Simulador */}
        {!ritmo.concluido && projeto.status !== 'concluído' && simulacao && (
          <div className="card p-4 space-y-3">
            <h3 className="font-bold">💡 E se cortássemos…</h3>
            <label className="block">
              <span className="flex justify-between text-sm text-suave"><span>por mês em Delivery/Lazer</span><strong className="text-texto text-base">{moeda(corte)}</strong></span>
              <input type="range" min={0} max={1000} step={50} value={corte} onChange={(e) => setCorte(Number(e.target.value))} className="w-full h-12 accent-[var(--primaria)]" aria-label="Quanto cortar por mês" />
              <span className="flex justify-between text-xs text-suave"><span>R$ 0</span><span>R$ 1.000</span></span>
            </label>
            <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--primaria) 18%, var(--bg-painel))' }}>
              {corte === 0 ? (
                <p className="text-lg leading-snug">Mexa no controle para ver quanto tempo a meta pode sair mais cedo.</p>
              ) : simulacao.mesesComCorte === null ? (
                <p className="text-lg leading-snug">Ainda sem previsão — comece com um aporte e a conta aparece aqui.</p>
              ) : (
                <p className="text-lg leading-snug">
                  Guardando mais <strong>{moeda(corte)}/mês</strong>, a meta sai em <strong>{mesesTexto(simulacao.mesesComCorte)}</strong>
                  {simulacao.competenciaComCorte ? ` (${nomeCompetencia(simulacao.competenciaComCorte)})` : ''}
                  {simulacao.mesesAntes !== null && simulacao.mesesAntes > 0 ? <> — <strong className="text-verde">{simulacao.mesesAntes} {simulacao.mesesAntes === 1 ? 'mês' : 'meses'} antes</strong> do ritmo atual.</> : simulacao.mesesSemCorte === null ? <> — hoje, sem aportes, ela não tem data.</> : '.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Aportes */}
        <div className="card p-4">
          <h3 className="font-bold mb-3">Quem já guardou ({aportes.length})</h3>
          {aportes.length === 0 ? (
            <p className="text-suave">Ainda não há aportes. O primeiro passo é o mais importante.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {aportes.map((a) => {
                const u = usuarioPorId(boot.usuarios, a.usuario_id)
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <Avatar usuario={u} tamanho={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u?.apelido ?? 'Membro'}{a.observacao ? <span className="font-normal text-suave"> — {a.observacao}</span> : null}</div>
                      <div className="text-sm text-suave">{dataBr(a.data)}</div>
                    </div>
                    <div className="font-bold text-verde whitespace-nowrap">+ {moeda(a.valor)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {ehAdmin && (
          <div className="card p-4 space-y-2">
            <h3 className="titulo-secao">Administração</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="botao botao-secundario" onClick={() => setEditando(true)}>✏️ Editar</button>
              {projeto.status === 'ativo' ? (
                <button className="botao botao-secundario" onClick={() => mudarStatus('pausado', 'Sonho pausado.')}>⏸️ Pausar</button>
              ) : projeto.status !== 'concluído' ? (
                <button className="botao botao-verde" onClick={() => mudarStatus('ativo', 'Sonho retomado!')}>▶️ Retomar</button>
              ) : <span />}
              <button className="botao botao-perigo col-span-2" onClick={excluir}>🗑️ Excluir (arquivar)</button>
            </div>
          </div>
        )}
      </div>

      <FolhaAporte aberta={aporteAberto} aoFechar={() => setAporteAberto(false)} projeto={projeto} aoAportado={aoAportado} />
      <FormularioProjeto aberto={editando} aoFechar={() => setEditando(false)} inicial={projeto} aoSalvo={(p) => setProjeto(p)} />
    </>
  )
}
