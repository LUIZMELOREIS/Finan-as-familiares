/**
 * /painel — dashboard no formato da referência (escuro, roxo/magenta/amarelo):
 * filtros (ano, mês, membro), KPIs com sparkline, donuts mês/ano, Análise Mensal,
 * anéis de participação anual, detalhamento por categoria, Receitas × Despesas,
 * orçado × realizado, gastos por membro e evolução da poupança dos sonhos.
 * Tudo clicável: abre a folha com os lançamentos filtrados. Júnior não acessa.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import type { DadosPainel } from '../tipos'
import { MESES, moeda } from '../util/formato'
import { Carregando } from '../componentes/Carregando'
import { Filtros } from '../componentes/painel/Filtros'
import { Kpi } from '../componentes/painel/Kpi'
import { Donut } from '../componentes/painel/Donut'
import { AnaliseMensal } from '../componentes/painel/AnaliseMensal'
import { Aneis, type Anel } from '../componentes/painel/Aneis'
import { Detalhamento } from '../componentes/painel/Detalhamento'
import { ReceitasDespesas } from '../componentes/painel/ReceitasDespesas'
import { OrcadoRealizado } from '../componentes/painel/OrcadoRealizado'
import { GastosMembro } from '../componentes/painel/GastosMembro'
import { EvolucaoPoupanca } from '../componentes/painel/EvolucaoPoupanca'
import { FolhaLancamentos, type FiltroLancamentos } from '../componentes/painel/FolhaLancamentos'
import { CORES } from '../componentes/painel/tema'

const CORES_SUBGRUPO = [CORES.indigo, CORES.amarelo, CORES.magenta, CORES.laranja, CORES.verde, CORES.azul, CORES.vermelho]

export default function Painel() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [membro, setMembro] = useState('')
  const [dados, setDados] = useState<DadosPainel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [grupoSel, setGrupoSel] = useState('g_diaadia')
  const [filtro, setFiltro] = useState<FiltroLancamentos | null>(null)

  const ehJunior = boot.usuario.perfil === 'Júnior'
  useEffect(() => { if (ehJunior) avisar('O painel é só para os adultos da família.', { tipo: 'info' }) }, [ehJunior, avisar])

  useEffect(() => {
    if (ehJunior) return
    let ativo = true
    setCarregando(true)
    api<DadosPainel>('painel', { ano, usuario_id_filtro: membro || undefined })
      .then((d) => { if (ativo) setDados(d) })
      .catch((e) => { if (ativo) avisar(e instanceof Error ? e.message : 'Não foi possível carregar o painel', { tipo: 'erro' }) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [ano, membro, ehJunior, avisar])

  const { grupos, categorias, usuarios, cartoes } = boot
  const gruposOrdenados = useMemo(() => [...grupos].sort((a, b) => a.ordem - b.ordem), [grupos])
  const gruposDespesa = useMemo(() => gruposOrdenados.filter((g) => g.tipo !== 'receita'), [gruposOrdenados])
  useEffect(() => { if (!gruposDespesa.some((g) => g.id === grupoSel) && gruposDespesa[0]) setGrupoSel(gruposDespesa[0].id) }, [gruposDespesa, grupoSel])

  const competencia = `${ano}-${String(mes).padStart(2, '0')}`
  const mesAtual = dados?.meses[mes - 1]
  const mesAnterior = mes > 1 ? dados?.meses[mes - 2] : undefined
  const competenciasAno = useMemo(() => Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`), [ano])
  // Até que mês há dados: no ano atual, até o mês de hoje; em anos passados, 12; em anos futuros, nenhum.
  const ultimoMes = ano < hoje.getFullYear() ? 12 : ano > hoje.getFullYear() ? 0 : hoje.getMonth() + 1

  // Agregados do ano
  const ano_ = useMemo(() => {
    const porGrupo: Record<string, number> = {}
    const porCategoria: Record<string, number> = {}
    let despesas = 0
    let receitas = 0
    for (const m of dados?.meses ?? []) {
      despesas += m.despesas
      receitas += m.receitas
      for (const [g, v] of Object.entries(m.por_grupo)) porGrupo[g] = (porGrupo[g] ?? 0) + v
      for (const [c, v] of Object.entries(m.por_categoria)) porCategoria[c] = (porCategoria[c] ?? 0) + v
    }
    return { porGrupo, porCategoria, despesas, receitas }
  }, [dados])

  const fatiasMes = gruposDespesa.map((g) => ({ id: g.id, nome: g.nome, cor: g.cor, valor: mesAtual?.por_grupo[g.id] ?? 0 }))
  const fatiasAno = gruposDespesa.map((g) => ({ id: g.id, nome: g.nome, cor: g.cor, valor: ano_.porGrupo[g.id] ?? 0 }))

  // Anéis por subgrupo (ano)
  const aneis: Anel[] = useMemo(() => {
    const porSub = new Map<string, number>()
    for (const c of categorias) {
      if (c.tipo !== 'despesa') continue
      const v = ano_.porCategoria[c.id] ?? 0
      if (!v) continue
      const chave = c.subgrupo || grupos.find((g) => g.id === c.grupo_id)?.nome || 'Outros'
      porSub.set(chave, (porSub.get(chave) ?? 0) + v)
    }
    return [...porSub.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor], i) => ({ id: nome, nome, valor, pct: ano_.despesas ? (valor / ano_.despesas) * 100 : 0, cor: CORES_SUBGRUPO[i % CORES_SUBGRUPO.length] }))
  }, [categorias, grupos, ano_])

  const categoriasDoGrupo = categorias
    .filter((c) => c.grupo_id === grupoSel)
    .map((c) => ({ id: c.id, nome: c.nome, valor: mesAtual?.por_categoria[c.id] ?? 0, cor: c.cor }))

  const linhasOrcamento = useMemo(() => {
    if (!dados) return []
    return Object.entries(dados.orcado_por_categoria)
      .map(([id, orcado]) => ({ categoria: categorias.find((c) => c.id === id), orcado, realizado: mesAtual?.por_categoria[id] ?? 0 }))
      .filter((l): l is { categoria: NonNullable<typeof l.categoria>; orcado: number; realizado: number } => !!l.categoria && l.orcado > 0)
  }, [dados, categorias, mesAtual])

  const nomeMes = `${MESES[mes - 1]} de ${ano}`
  const abrir = (f: Omit<FiltroLancamentos, 'usuario_id_filtro'>) => setFiltro({ ...f, usuario_id_filtro: membro || undefined })

  // Toque num anel de subgrupo: lista todas as categorias do subgrupo no ano (várias chamadas, uma por categoria seria demais — usamos o grupo e filtramos no cliente).
  function abrirSubgrupo(a: Anel) {
    const cats = categorias.filter((c) => (c.subgrupo || grupos.find((g) => g.id === c.grupo_id)?.nome) === a.nome)
    const grupoId = cats[0]?.grupo_id
    if (cats.length === 1) abrir({ titulo: `${a.nome} · ${ano}`, categoria_id: cats[0].id, competencias: competenciasAno })
    else abrir({ titulo: `${a.nome} · ${ano}`, grupo_id: grupoId, competencias: competenciasAno })
  }

  if (ehJunior) return <Navigate to="/" replace />

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear()]
  const nomeMembro = membro ? usuarios.find((u) => u.id === membro)?.apelido : undefined

  return (
    <div className="bg-app min-h-dvh">
      <div className="max-w-7xl mx-auto p-4 lg:flex lg:gap-5">
        <div className="lg:hidden mb-3">
          <h1 className="text-xl font-extrabold leading-tight">Finanças da Família</h1>
          <div className="text-xs text-suave">Painel · {nomeMes}{nomeMembro ? ` · ${nomeMembro}` : ''}</div>
        </div>

        <Filtros anos={anos} ano={ano} aoMudarAno={setAno} mes={mes} aoMudarMes={setMes} usuarios={usuarios} membro={membro} aoMudarMembro={setMembro} />

        <main className="flex-1 min-w-0 mt-4 lg:mt-0 space-y-4">
          {carregando && !dados && <Carregando texto="Montando o painel…" />}
          {dados && (
            <div className={`space-y-4 ${carregando ? 'opacity-60 transition' : ''}`} aria-busy={carregando}>
              <div className="hidden lg:flex items-baseline justify-between">
                <h1 className="text-2xl font-extrabold">{nomeMes}{nomeMembro ? ` · ${nomeMembro}` : ''}</h1>
                <div className="text-sm text-suave">Entrou {moeda(mesAtual?.receitas ?? 0)} · Saiu {moeda(mesAtual?.despesas ?? 0)}</div>
              </div>

              {/* Linha 1: KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Kpi id="saldo" titulo="Saldo do mês" valor={mesAtual?.saldo ?? 0} anterior={mesAnterior ? mesAnterior.saldo : null} serie={dados.meses.map((m) => m.saldo)} ultimoMes={ultimoMes} cor={CORES.indigo} />
                <Kpi id="despesas" titulo="Despesas do mês" valor={mesAtual?.despesas ?? 0} anterior={mesAnterior ? mesAnterior.despesas : null} serie={dados.meses.map((m) => m.despesas)} ultimoMes={ultimoMes} cor={CORES.magenta} aoTocar={() => abrir({ titulo: `Despesas · ${nomeMes}`, competencia })} />
              </div>

              {/* Linha 2: donuts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Donut titulo="Despesas no Mês" subtitulo={nomeMes} fatias={fatiasMes} despesas={mesAtual?.despesas ?? 0} receitas={mesAtual?.receitas ?? 0} aoTocar={(g) => abrir({ titulo: `${grupos.find((x) => x.id === g)?.nome} · ${nomeMes}`, grupo_id: g, competencia })} />
                <Donut titulo="Despesas no Ano" subtitulo={String(ano)} fatias={fatiasAno} despesas={ano_.despesas} receitas={ano_.receitas} aoTocar={(g) => abrir({ titulo: `${grupos.find((x) => x.id === g)?.nome} · ${ano}`, grupo_id: g, competencias: competenciasAno })} />
              </div>

              <AnaliseMensal meses={dados.meses} mesSelecionado={mes} aoTocarMes={setMes} />

              <Aneis aneis={aneis} aoTocar={abrirSubgrupo} />

              <Detalhamento
                grupos={gruposOrdenados}
                grupoSel={grupoSel}
                aoMudarGrupo={setGrupoSel}
                categorias={categoriasDoGrupo}
                totaisPorGrupo={mesAtual?.por_grupo ?? {}}
                aoTocarCategoria={(c) => abrir({ titulo: `${categorias.find((x) => x.id === c)?.nome} · ${nomeMes}`, categoria_id: c, competencia })}
              />

              <ReceitasDespesas meses={dados.meses} ultimoMes={ultimoMes} aoTocarMes={setMes} />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <OrcadoRealizado linhas={linhasOrcamento} aoTocar={(c) => abrir({ titulo: `${categorias.find((x) => x.id === c)?.nome} · ${nomeMes}`, categoria_id: c, competencia })} />
                <GastosMembro usuarios={usuarios} porUsuario={mesAtual?.por_usuario ?? {}} aoTocar={(u) => setFiltro({ titulo: `Gastos de ${usuarios.find((x) => x.id === u)?.apelido} · ${nomeMes}`, competencia, usuario_id_filtro: u })} />
              </div>

              <EvolucaoPoupanca poupanca={dados.poupanca_projetos} ultimoMes={ultimoMes} />
            </div>
          )}
        </main>
      </div>

      <FolhaLancamentos filtro={filtro} aoFechar={() => setFiltro(null)} categorias={categorias} usuarios={usuarios} cartoes={cartoes} />
    </div>
  )
}
