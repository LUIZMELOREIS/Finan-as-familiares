import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { useBoot, useSessao } from '../store/sessao'
import { api } from '../api/cliente'
import type { ContaAPagar } from '../tipos'
import { competenciaDe, dataBr, moeda } from '../util/formato'
import { SeletorMes } from '../componentes/config/comuns'
import { CalendarioVencimentos, COR_SITUACAO, NOME_SITUACAO, situacaoDe } from '../componentes/contas/CalendarioVencimentos'
import { DetalheConta } from '../componentes/contas/DetalheConta'
import { EnviarFatura } from '../componentes/contas/EnviarFatura'

export default function Contas() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [competencia, setCompetencia] = useState(competenciaDe())
  const [contas, setContas] = useState<ContaAPagar[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [dia, setDia] = useState<number | null>(null)
  const [aberta, setAberta] = useState<ContaAPagar | null>(null)
  const ehJunior = boot.usuario.perfil === 'Júnior'

  const carregar = useCallback(async () => {
    setContas(null)
    setDia(null)
    try {
      setContas(await api<ContaAPagar[]>('listar_contas_a_pagar', { competencia }))
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar')
      setContas([])
    }
  }, [competencia])
  useEffect(() => { if (!ehJunior) carregar() }, [carregar, ehJunior])

  const fixaDe = (c: ContaAPagar) => boot.contas_fixas.find((f) => f.id === c.conta_fixa_id)
  const categoriaDe = (c: ContaAPagar) => boot.categorias.find((k) => k.id === fixaDe(c)?.categoria_id)

  const previstas = useMemo(() => boot.contas_fixas.filter((f) => f.ativa !== false && !(contas ?? []).some((c) => c.conta_fixa_id === f.id)), [boot.contas_fixas, contas])
  const lista = useMemo(() => (contas ?? []).filter((c) => dia === null || Number(c.vencimento.slice(8, 10)) === dia).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)), [contas, dia])
  const abertas = (contas ?? []).filter((c) => c.status === 'aberta')
  const totalAberto = abertas.reduce((s, c) => s + c.valor, 0)
  const totalPago = (contas ?? []).filter((c) => c.status === 'paga').reduce((s, c) => s + c.valor, 0)
  const totalPrevisto = previstas.reduce((s, f) => s + f.valor_previsto, 0)

  function atualizar(c: ContaAPagar) {
    setContas((l) => {
      const base = l ?? []
      if (c.competencia !== competencia) return base
      return base.some((x) => x.id === c.id) ? base.map((x) => (x.id === c.id ? c : x)) : [...base, c]
    })
  }

  if (ehJunior) {
    return (
      <>
        <Cabecalho titulo="Contas da Casa" voltarPara="/mais" />
        <div className="max-w-3xl mx-auto p-4"><Vazio icone="🔒" titulo="Área dos adultos" texto="As contas da casa ficam com os responsáveis. Você pode acompanhar a mesada e os sonhos da família." /></div>
      </>
    )
  }

  return (
    <>
      <Cabecalho titulo="Contas da Casa" voltarPara="/mais" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <SeletorMes competencia={competencia} aoMudar={setCompetencia} />

        {contas === null ? (
          <Carregando texto="Buscando as contas do mês…" />
        ) : erro ? (
          <Vazio icone="⚠️" titulo="Não deu para carregar" texto={erro}><button className="botao botao-primario" onClick={carregar}>Tentar de novo</button></Vazio>
        ) : (
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card p-3 text-center"><div className="text-xs text-suave">A pagar</div><div className="font-extrabold text-[0.95rem] tabular-nums" style={{ color: abertas.some((c) => situacaoDe(c) === 'vencida') ? 'var(--vermelho)' : undefined }}>{moeda(totalAberto)}</div><div className="text-xs text-suave">{abertas.length} conta(s)</div></div>
              <div className="card p-3 text-center"><div className="text-xs text-suave">Pagas</div><div className="font-extrabold text-[0.95rem] tabular-nums text-verde">{moeda(totalPago)}</div></div>
              <div className="card p-3 text-center"><div className="text-xs text-suave">Previstas</div><div className="font-extrabold text-[0.95rem] tabular-nums">{moeda(totalPrevisto)}</div><div className="text-xs text-suave">{previstas.length} sem fatura</div></div>
            </div>

            <EnviarFatura contasFixas={boot.contas_fixas} competenciaPadrao={competencia} avisar={avisar} aoSalvar={atualizar} classe="w-full !min-h-14 text-lg" />

            {/* Calendário */}
            <section className="card p-4">
              <h2 className="titulo-secao mb-3">Calendário de vencimentos</h2>
              <CalendarioVencimentos competencia={competencia} contas={contas} previstas={previstas.map((f) => f.dia_vencimento)} diaSelecionado={dia} aoEscolherDia={setDia} />
            </section>

            {/* Lista */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="titulo-secao">{dia ? `Contas do dia ${dia}` : 'Contas do mês'}</h2>
                {dia && <button className="botao botao-fantasma !min-h-10 text-sm" onClick={() => setDia(null)}>Ver todas</button>}
              </div>
              {lista.length ? (
                <ul className="space-y-2">
                  {lista.map((c) => {
                    const f = fixaDe(c)
                    const cat = categoriaDe(c)
                    const sit = situacaoDe(c)
                    return (
                      <li key={c.id}>
                        <button className="w-full card card-toque p-3 flex items-center gap-3 text-left" onClick={() => setAberta(c)}>
                          <span className="text-3xl w-10 text-center" aria-hidden>{cat?.icone ?? '🧾'}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold truncate">{f?.nome ?? 'Conta'}</span>
                            <span className="block text-sm text-suave">Vence {dataBr(c.vencimento)}{c.consumo ? ` · ${c.consumo}` : ''}</span>
                          </span>
                          <span className="text-right">
                            <span className="block font-bold tabular-nums">{moeda(c.valor)}</span>
                            <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: COR_SITUACAO[sit] }}>{NOME_SITUACAO[sit]}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <Vazio icone="📭" titulo={dia ? 'Nenhuma conta nesse dia' : 'Nenhuma fatura neste mês ainda'} texto="Envie a fatura (foto ou PDF) ou deixe o e-mail trazer sozinho." />
              )}
            </section>

            {/* Previstas */}
            {previstas.length > 0 && !dia && (
              <section>
                <h2 className="titulo-secao mb-2">Previstas (ainda sem fatura)</h2>
                <ul className="space-y-2">
                  {previstas.map((f) => {
                    const cat = boot.categorias.find((k) => k.id === f.categoria_id)
                    return (
                      <li key={f.id} className="card p-3 flex items-center gap-3 opacity-80">
                        <span className="text-3xl w-10 text-center" aria-hidden>{cat?.icone ?? '🧾'}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">{f.nome}</span>
                          <span className="block text-sm text-suave">Costuma vencer dia {f.dia_vencimento}</span>
                        </span>
                        <span className="font-bold tabular-nums text-suave">~{moeda(f.valor_previsto)}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <Link to="/configuracoes/contas-fixas" className="botao botao-secundario w-full">⚙️ Cadastrar ou editar contas fixas</Link>
          </>
        )}
      </div>

      <DetalheConta
        conta={aberta}
        contaFixa={aberta ? fixaDe(aberta) : undefined}
        categoria={aberta ? categoriaDe(aberta) : undefined}
        usuarios={boot.usuarios}
        aoFechar={() => setAberta(null)}
        aoAtualizar={atualizar}
        avisar={avisar}
      />
    </>
  )
}
