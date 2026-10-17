import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Orcamento as ItemOrcamento } from '../../tipos'
import { Carregando } from '../Carregando'
import { SeletorMes } from './comuns'
import { competenciaDe, lerValor, moeda, numero, somarMeses } from '../../util/formato'

export function Orcamento() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const [competencia, setCompetencia] = useState(competenciaDe())
  const [valores, setValores] = useState<Record<string, string> | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)

  const carregar = useCallback(async () => {
    setValores(null)
    try {
      const itens = await api<ItemOrcamento[]>('listar_orcamento', { competencia })
      const mapa: Record<string, string> = {}
      for (const i of itens) if (i.valor_planejado) mapa[i.categoria_id] = numero(i.valor_planejado)
      setValores(mapa)
      setSujo(false)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Erro ao carregar', { tipo: 'erro' })
      setValores({})
    }
  }, [competencia, avisar])
  useEffect(() => { carregar() }, [carregar])

  const grupos = useMemo(() => [...boot.grupos].sort((a, b) => a.ordem - b.ordem), [boot.grupos])
  const cats = useMemo(() => boot.categorias.filter((c) => c.ativa !== false), [boot.categorias])
  const v = (id: string) => lerValor(valores?.[id] ?? '')

  const rendaEsperada = cats.filter((c) => c.tipo === 'receita').reduce((s, c) => s + v(c.id), 0)
  const totalPlanejado = cats.filter((c) => c.tipo === 'despesa').reduce((s, c) => s + v(c.id), 0)
  const dar = cats.filter((c) => c.grupo_id === 'g_dizimo').reduce((s, c) => s + v(c.id), 0)
  const poupar = cats.filter((c) => c.grupo_id === 'g_sonhos' || boot.grupos.find((g) => g.id === c.grupo_id)?.tipo === 'projeto').reduce((s, c) => s + v(c.id), 0)
  const viver = totalPlanejado - dar - poupar
  const cfg = boot.config

  async function salvar() {
    if (!valores) return
    setSalvando(true)
    try {
      const itens: ItemOrcamento[] = Object.entries(valores).map(([categoria_id, txt]) => ({ competencia, categoria_id, valor_planejado: lerValor(txt) })).filter((i) => i.valor_planejado > 0)
      await api('salvar_orcamento', { competencia, itens })
      avisar('Orçamento salvo ✅', { tipo: 'ok' })
      setSujo(false)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  async function copiarAnterior() {
    const de = somarMeses(competencia, -1)
    if (sujo && !confirm('Isso substitui os valores deste mês pelos do mês anterior. Continuar?')) return
    try {
      await api('copiar_orcamento', { de, para: competencia })
      avisar('Copiado do mês anterior ✅', { tipo: 'ok' })
      carregar()
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao copiar', { tipo: 'erro' }) }
  }

  // Função (não componente) para o campo não perder o foco a cada tecla.
  const linha = (id: string, icone: string, nome: string) => (
    <label key={id} className="flex items-center gap-2 min-h-12">
      <span className="text-xl w-8 text-center" aria-hidden>{icone}</span>
      <span className="flex-1 text-sm">{nome}</span>
      <span className="text-suave text-sm">R$</span>
      <input className="campo !w-28 text-right tabular-nums" inputMode="decimal" value={valores?.[id] ?? ''} placeholder="0,00" aria-label={`Planejado para ${nome}`} onChange={(e) => { setValores((m) => ({ ...(m ?? {}), [id]: e.target.value })); setSujo(true) }} />
    </label>
  )

  const pct = (parte: number) => (rendaEsperada ? Math.round((parte / rendaEsperada) * 100) : 0)

  return (
    <div className="space-y-4">
      <SeletorMes competencia={competencia} aoMudar={setCompetencia} />
      {valores === null ? <Carregando texto="Carregando orçamento…" /> : (
        <>
          <div className="card p-4 space-y-2">
            <div className="flex justify-between"><span className="text-suave">Renda esperada</span><strong className="tabular-nums">{moeda(rendaEsperada)}</strong></div>
            <div className="flex justify-between"><span className="text-suave">Total planejado (despesas)</span><strong className="tabular-nums">{moeda(totalPlanejado)}</strong></div>
            <div className="progresso"><span style={{ width: `${Math.min(100, rendaEsperada ? (totalPlanejado / rendaEsperada) * 100 : 0)}%`, background: totalPlanejado > rendaEsperada ? 'var(--vermelho)' : 'var(--verde)' }} /></div>
            <div className={`text-sm font-semibold ${totalPlanejado > rendaEsperada && rendaEsperada ? 'text-vermelho' : 'text-verde'}`}>
              {rendaEsperada ? (totalPlanejado > rendaEsperada ? `Planejado acima da renda em ${moeda(totalPlanejado - rendaEsperada)}` : `Sobra planejada: ${moeda(rendaEsperada - totalPlanejado)}`) : 'Informe as entradas esperadas para comparar.'}
            </div>
          </div>

          {cfg.fe_ativa && (
            <div className="card p-4">
              <div className="titulo-secao mb-2">Divisão Dar → Poupar → Viver</div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  { nome: '🙏 Dar', meta: cfg.divisao_dar, real: pct(dar) },
                  { nome: '🐷 Poupar', meta: cfg.divisao_poupar, real: pct(poupar) },
                  { nome: '🏡 Viver', meta: cfg.divisao_viver, real: pct(viver) },
                ].map((d) => (
                  <div key={d.nome} className="bg-painel rounded-xl p-2">
                    <div className="font-semibold">{d.nome}</div>
                    <div className="text-lg font-extrabold tabular-nums">{d.real}%</div>
                    <div className="text-xs text-suave">meta {d.meta}%</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-suave mt-2">Referência da família (em Configurações › Fé). Princípio, não obrigação.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button className="botao botao-secundario" onClick={copiarAnterior}>📋 Copiar do mês anterior</button>
            <button className="botao botao-primario" onClick={salvar} disabled={salvando || !sujo}>{salvando ? '⏳ Salvando…' : '💾 Salvar'}</button>
          </div>

          {grupos.map((g) => {
            const doGrupo = cats.filter((c) => c.grupo_id === g.id)
            if (!doGrupo.length) return null
            const soma = doGrupo.reduce((s, c) => s + v(c.id), 0)
            return (
              <section key={g.id} className="card p-3">
                <div className="flex items-center justify-between mb-1" style={{ borderLeft: `5px solid ${g.cor}`, paddingLeft: 10 }}>
                  <h3 className="font-bold flex items-center gap-2"><span aria-hidden>{g.icone}</span>{g.nome}</h3>
                  <span className="font-bold tabular-nums text-sm">{moeda(soma)}</span>
                </div>
                {g.tipo === 'receita' && <p className="text-xs text-suave mb-1">Quanto a família espera que entre no mês.</p>}
                <div className="divide-y divide-borda">
                  {doGrupo.map((c) => linha(c.id, c.icone, c.nome))}
                </div>
              </section>
            )
          })}
          {sujo && <button className="botao botao-primario w-full !min-h-14 sticky bottom-24" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar orçamento'}</button>}
        </>
      )}
    </div>
  )
}
