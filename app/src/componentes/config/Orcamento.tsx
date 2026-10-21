import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Config, Orcamento as ItemOrcamento } from '../../tipos'
import { api } from '../../api/cliente'
import { competenciaDosFiltros, useBoot, useSessao } from '../../store/sessao'
import { moeda, nomeCompetencia, somarMeses } from '../../util/formato'
import { Icone, corVar } from '../Icone'
import { Carregando } from '../Carregando'
import { useAcao } from './comuns'

type Chave = 'divisao_dar' | 'divisao_poupar' | 'divisao_viver'
const FATIAS: Array<{ chave: Chave; nome: string; cor: string; descricao: string }> = [
  { chave: 'divisao_dar', nome: 'Dar', cor: 'green', descricao: 'dízimo, ofertas e ajuda' },
  { chave: 'divisao_poupar', nome: 'Poupar', cor: 'gold', descricao: 'projetos e reserva' },
  { chave: 'divisao_viver', nome: 'Viver', cor: 'indigo', descricao: 'contas e dia a dia' },
]

/** Ajusta uma fatia e redistribui as outras duas proporcionalmente para somar 100. */
export function redistribuir(atual: Record<Chave, number>, chave: Chave, valor: number): Record<Chave, number> {
  const v = Math.max(0, Math.min(100, Math.round(valor)))
  const outras = FATIAS.map((f) => f.chave).filter((k) => k !== chave) as [Chave, Chave]
  const somaOutras = atual[outras[0]] + atual[outras[1]]
  const resto = 100 - v
  const a = somaOutras > 0 ? Math.round((atual[outras[0]] / somaOutras) * resto) : Math.round(resto / 2)
  return { ...atual, [chave]: v, [outras[0]]: a, [outras[1]]: resto - a }
}

function DivisaoRenda() {
  const boot = useBoot()
  const atualizarConfig = useSessao((e) => e.atualizarConfig)
  const { rodar, ocupado } = useAcao()
  const [d, setD] = useState<Record<Chave, number>>({ divisao_dar: boot.config.divisao_dar, divisao_poupar: boot.config.divisao_poupar, divisao_viver: boot.config.divisao_viver })
  const salvar = () => rodar(async () => atualizarConfig(await api<Config>('salvar_config', { config: d })), 'Divisão da renda salva.')
  return (
    <div className="card">
      <h3>Divisão da renda <span className="sub">Dar → Poupar → Viver</span></h3>
      <div className="bar" style={{ height: 10, display: 'flex' }} aria-hidden="true">
        {FATIAS.map((f) => <span key={f.chave} style={{ width: `${d[f.chave]}%`, background: corVar(f.cor), borderRadius: 0 }} />)}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {FATIAS.map((f) => (
          <label key={f.chave} className="grid items-center gap-x-3" style={{ gridTemplateColumns: '92px 1fr 52px' }}>
            <span style={{ fontSize: 13 }}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: corVar(f.cor), marginRight: 6 }} />{f.nome}<small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>{f.descricao}</small></span>
            <input type="range" min={0} max={100} value={d[f.chave]} onChange={(e) => setD(redistribuir(d, f.chave, Number(e.target.value)))} aria-label={`${f.nome} (%)`} style={{ accentColor: corVar(f.cor), minHeight: 44 }} />
            <b className="num" style={{ textAlign: 'right', fontSize: 13 }}>{d[f.chave]} %</b>
          </label>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0' }}>O painel compara o planejado com o realizado. Mexer numa fatia ajusta as outras para fechar 100 %.</p>
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar divisão</button>
        <button className="btn btn-ghost" onClick={() => setD({ divisao_dar: 10, divisao_poupar: 20, divisao_viver: 70 })}>10 / 20 / 70</button>
      </div>
    </div>
  )
}

export function Orcamento() {
  const boot = useBoot()
  const filtros = useSessao((e) => e.filtros)
  const { rodar, ocupado } = useAcao()
  const [comp, setComp] = useState(competenciaDosFiltros(filtros))
  const [valores, setValores] = useState<Record<string, number>>({})
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'t_fixas' | 't_variaveis' | 't_receitas'>('t_fixas')

  const carregar = useCallback(async (c: string) => {
    setCarregando(true)
    try {
      const itens = await api<ItemOrcamento[]>('listar_orcamento', { competencia: c })
      setValores(Object.fromEntries(itens.map((i) => [i.categoria_id, i.valor_planejado])))
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar(comp).catch(() => setCarregando(false)) }, [comp, carregar])

  const planejado = (c: { id: string; orcamento_mensal: number }) => valores[c.id] ?? c.orcamento_mensal ?? 0
  const categorias = boot.categorias.filter((c) => c.ativa && !c.oculta_cardapio)
  const totais = useMemo(() => {
    const soma = (tid: string) => categorias.filter((c) => c.tipo_id === tid).reduce((s, c) => s + planejado(c), 0)
    return { receitas: soma('t_receitas'), fixas: soma('t_fixas'), variaveis: soma('t_variaveis') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores, boot.categorias])
  const despesas = totais.fixas + totais.variaveis
  const sobra = totais.receitas - despesas

  const salvar = () => rodar(async () => {
    const itens: ItemOrcamento[] = categorias.map((c) => ({ competencia: comp, categoria_id: c.id, valor_planejado: planejado(c) }))
    await api('salvar_orcamento', { competencia: comp, itens })
  }, `Orçamento de ${nomeCompetencia(comp)} salvo.`)
  const copiar = () => rodar(async () => {
    await api('copiar_orcamento', { de: somarMeses(comp, -1), para: comp })
    await carregar(comp)
  }, `Copiado de ${nomeCompetencia(somarMeses(comp, -1))}.`)

  const grupos = boot.grupos.filter((g) => g.tipo_id === aba && g.ativo !== false).sort((a, b) => a.ordem - b.ordem)
  const tipos = boot.tipos.filter((t) => t.id !== 't_projetos').sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="card">
        <h3>
          <span className="flex items-center gap-1">
            <button className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => setComp(somarMeses(comp, -1))} aria-label="Mês anterior"><Icone nome="chevron-left" /></button>
            <span style={{ minWidth: 150, textAlign: 'center' }}>{nomeCompetencia(comp)}</span>
            <button className="icon-btn" style={{ width: 44, height: 44 }} onClick={() => setComp(somarMeses(comp, 1))} aria-label="Próximo mês"><Icone nome="chevron-right" /></button>
          </span>
          <span className="sub hidden sm:inline">valor planejado por categoria</span>
        </h3>
        <div className="tabs" role="tablist">
          {tipos.map((t) => <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id as typeof aba)}>{t.nome}</button>)}
        </div>
        {aba === 't_receitas' && <p className="sub" style={{ margin: '0 0 10px' }}>Informe aqui o salário e as outras entradas previstas do mês. O Painel usa esses valores como "Previsto" das receitas; sem eles, usa o que entrou no mês anterior.</p>}
        {carregando ? <Carregando texto="Lendo o orçamento…" /> : grupos.map((g) => (
          <div key={g.id} className="menu-group" style={{ ['--c' as string]: corVar(g.cor) }}>
            <h4>{g.nome}</h4>
            <div className="rows">
              {categorias.filter((c) => c.grupo_id === g.id).map((c) => (
                <div key={c.id} className="row" style={{ minHeight: 48 }}>
                  <span className="ico-sm" style={{ color: corVar(g.cor) }}><Icone nome={c.icone} /></span>
                  <span className="t"><b>{c.nome}</b><small>{c.orcamento_mensal ? `Padrão ${moeda(c.orcamento_mensal)}` : 'Sem padrão'}</small></span>
                  <input className="campo num" type="number" inputMode="decimal" min={0} step="1" value={valores[c.id] ?? c.orcamento_mensal ?? 0} onChange={(e) => setValores({ ...valores, [c.id]: Number(e.target.value) })} aria-label={`Planejado para ${c.nome}`} style={{ width: 118, textAlign: 'right', padding: '8px 10px' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="confirm">
          <p>Total do tipo: <b className="num">{moeda(aba === 't_receitas' ? totais.receitas : aba === 't_fixas' ? totais.fixas : totais.variaveis)}</b></p>
          <div className="flex gap-2 flex-wrap justify-end">
            <button className="btn btn-ghost" disabled={ocupado || carregando} onClick={copiar}><Icone nome="copy" />Copiar do mês anterior</button>
            <button className="btn btn-primary" disabled={ocupado || carregando} onClick={salvar}><Icone nome="check" />Salvar orçamento</button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="card">
          <h3>Resumo de {nomeCompetencia(comp, true)}</h3>
          <div className="rows">
            <div className="row"><span className="t"><b>Receita prevista</b>{!totais.receitas && <small>Preencha na aba Receitas</small>}</span><span className="amt num" style={{ color: 'var(--green)' }}>{moeda(totais.receitas)}</span></div>
            <div className="row"><span className="t"><b>Despesas fixas</b></span><span className="amt num">{moeda(totais.fixas)}</span></div>
            <div className="row"><span className="t"><b>Despesas variáveis</b></span><span className="amt num">{moeda(totais.variaveis)}</span></div>
            <div className="row"><span className="t"><b>Total planejado</b><small>{totais.receitas ? `${Math.round((despesas / totais.receitas) * 100)} % da receita` : ''}</small></span><span className="amt num">{moeda(despesas)}</span></div>
            <div className="row"><span className="t"><b>{sobra >= 0 ? 'Sobra para poupar' : 'Falta'}</b></span><span className="amt num" style={{ color: sobra >= 0 ? 'var(--green)' : 'var(--red)' }}>{moeda(Math.abs(sobra))}</span></div>
          </div>
          <div className="bar mt-2"><span className={despesas > totais.receitas ? 'estourou' : ''} style={{ width: `${Math.min(100, totais.receitas ? (despesas / totais.receitas) * 100 : 0)}%`, ['--c' as string]: 'var(--indigo)' }} /></div>
        </div>
        <DivisaoRenda />
      </div>
    </div>
  )
}
