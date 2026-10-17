/**
 * Tela inicial: capa da família, seletor de mês, Entrou/Saiu/Sobrou,
 * 5 cards grandes (um por grupo), pendências da Caixa de Entrada,
 * contas a vencer e uma mensagem contextual leve.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import type { ContaAPagar } from '../tipos'
import { competenciaDe, moeda } from '../util/formato'
import { useResumoMes } from '../hooks/useResumoMes'
import { Capa } from '../componentes/inicio/Capa'
import { SeletorMes } from '../componentes/inicio/SeletorMes'
import { FaixaResumo } from '../componentes/inicio/FaixaResumo'
import { CardGrupo } from '../componentes/inicio/CardGrupo'
import { ContasAVencer } from '../componentes/inicio/ContasAVencer'
import { MensagemContextual } from '../componentes/inicio/MensagemContextual'

interface Mesada { mesada_mensal: number; gasto: number; saldo: number; cofrinho: number }

export default function Inicio() {
  const boot = useBoot()
  const pendentesCaixa = useSessao((e) => e.pendentesCaixa)
  const [competencia, setCompetencia] = useState(competenciaDe())
  const { resumo, carregando, erro } = useResumoMes(competencia)
  const [contas, setContas] = useState<ContaAPagar[]>([])
  const [mesada, setMesada] = useState<Mesada | null>(null)

  const { config, usuario, grupos, categorias, projetos, contas_fixas } = boot
  const ehJunior = usuario.perfil === 'Júnior'
  const ehMesAtual = competencia === competenciaDe()

  // Contas a vencer (só adultos; Júnior não tem acesso a essa ação).
  useEffect(() => {
    if (ehJunior) return
    api<ContaAPagar[]>('listar_contas_a_pagar', { status: 'aberta' }).then(setContas).catch(() => setContas([]))
  }, [ehJunior])

  // Mesada do Júnior.
  useEffect(() => {
    if (!ehJunior) return
    api<Mesada>('mesada', { competencia }).then(setMesada).catch(() => setMesada(null))
  }, [ehJunior, competencia])

  const gruposOrdenados = useMemo(() => [...grupos].sort((a, b) => a.ordem - b.ordem), [grupos])

  return (
    <div className="pb-4">
      <Capa config={config} usuario={usuario} versiculo={boot.versiculo_do_dia} />

      <div className="max-w-3xl mx-auto px-4 space-y-4 -mt-1">
        <SeletorMes competencia={competencia} aoMudar={setCompetencia} />

        {erro && <div className="card p-3 text-sm text-vermelho">{erro}</div>}
        {/* Júnior sem acesso aos salários não vê Entrou/Sobrou (ficariam distorcidos); vê a mesada no card abaixo. */}
        {(!ehJunior || config.junior_ve_salarios) && (
          <FaixaResumo entrou={resumo?.entrou ?? 0} saiu={resumo?.saiu ?? 0} sobrou={resumo?.sobrou ?? 0} carregando={carregando} />
        )}

        {pendentesCaixa > 0 && ehMesAtual && (
          <Link to="/caixa" className="card card-toque flex items-center gap-3 p-4 border border-magenta/60 bg-magenta/10" aria-label={`Você tem ${pendentesCaixa} compras para confirmar. Abrir Caixa de Entrada`}>
            <span className="text-3xl" aria-hidden>📥</span>
            <div className="flex-1">
              <div className="font-bold">Você tem {pendentesCaixa} {pendentesCaixa === 1 ? 'compra' : 'compras'} para confirmar</div>
              <div className="text-sm text-suave">Toque para dizer de que é cada uma.</div>
            </div>
            <span className="text-2xl text-suave" aria-hidden>›</span>
          </Link>
        )}

        <section className="space-y-3" aria-label="Grupos de gastos">
          {gruposOrdenados.map((g) => {
            if (g.tipo === 'receita' && ehJunior && !config.junior_ve_salarios) return null
            const totais = resumo?.por_grupo[g.id] ?? { realizado: 0, orcado: 0 }
            return <CardGrupo key={g.id} grupo={g} realizado={totais.realizado} orcado={totais.orcado} projetos={g.tipo === 'projeto' ? projetos : undefined} />
          })}

          {ehJunior && (
            <Link to="/mesada" className="card card-toque block p-4 border-l-4 border-l-verde" aria-label="Minha mesada">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-verde/20" aria-hidden>🐷</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg leading-tight">Minha mesada</div>
                  <div className="text-xs text-suave">{mesada ? `Gastou ${moeda(mesada.gasto)} de ${moeda(mesada.mesada_mensal)}` : 'Toque para ver'}</div>
                </div>
                {mesada && <div className={`numero-grande !text-xl tabular-nums ${mesada.saldo >= 0 ? 'text-verde' : 'text-vermelho'}`}>{moeda(mesada.saldo)}</div>}
              </div>
              {mesada && mesada.cofrinho > 0 && <div className="text-sm text-suave mt-2">🏦 No cofrinho dos sonhos: <span className="font-semibold text-texto">{moeda(mesada.cofrinho)}</span></div>}
            </Link>
          )}
        </section>

        {!ehJunior && <ContasAVencer contas={contas} contasFixas={contas_fixas} />}

        {config.fe_ativa && resumo && !carregando && <MensagemContextual resumo={resumo} categorias={categorias} />}
      </div>
    </div>
  )
}
