import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { BarraProgresso } from '../componentes/familia/BarraProgresso'
import { FormularioProjeto } from '../componentes/familia/FormularioProjeto'
import { calcularRitmo, ordenarProjetos } from '../componentes/familia/calculos'
import { api } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import { dataBr, hojeIso, moeda } from '../util/formato'
import type { Projeto, StatusProjeto } from '../tipos'

const ETIQUETA: Record<StatusProjeto, { texto: string; classe: string }> = {
  'votação': { texto: '🗳️ Em votação', classe: 'bg-amarelo text-black' },
  'ativo': { texto: '🟢 Ativo', classe: 'bg-verde text-white' },
  'concluído': { texto: '🎉 Concluído', classe: 'bg-primaria text-white' },
  'pausado': { texto: '⏸️ Pausado', classe: 'bg-borda text-texto' },
}

function CartaoSonho({ p }: { p: Projeto }) {
  const r = calcularRitmo(p, [], hojeIso())
  const atual = p.valor_atual ?? p.valor_inicial
  const et = ETIQUETA[p.status]
  return (
    <Link to={`/sonhos/${p.id}`} className="card card-toque block overflow-hidden" aria-label={`${p.nome}: ${Math.round(r.pct)}% da meta`}>
      {p.foto_url ? (
        <div className="relative h-36">
          <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-3 text-4xl drop-shadow" aria-hidden>{p.icone}</span>
        </div>
      ) : (
        <div className="h-28 flex items-center justify-center text-6xl" style={{ background: 'linear-gradient(135deg, var(--laranja), var(--amarelo))' }} aria-hidden>
          {p.status === 'concluído' ? '🎉' : p.icone}
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold leading-tight">{p.nome}</h2>
          <span className={`text-xs font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${et.classe}`}>{et.texto}</span>
        </div>
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="numero-grande">{moeda(atual)}</span>
          <span className="text-suave">de {moeda(p.meta_valor)}</span>
        </div>
        <BarraProgresso pct={r.pct} />
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="font-bold whitespace-nowrap">{Math.round(r.pct)}% guardado</span>
          {p.status === 'concluído' ? (
            <span className="text-verde font-semibold">Meta alcançada 🎉</span>
          ) : p.status === 'ativo' ? (
            <span className="text-suave text-right">Precisa de <strong className="text-texto">{moeda(r.necessarioMes)}</strong>/mês até {dataBr(p.data_alvo)}</span>
          ) : (
            <span className="text-suave">Até {dataBr(p.data_alvo)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function Sonhos() {
  const boot = useBoot()
  const atualizarProjetos = useSessao((e) => e.atualizarProjetos)
  const avisar = useSessao((e) => e.avisar)
  const [projetos, setProjetos] = useState<Projeto[]>(boot.projetos)
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const ehJunior = boot.usuario.perfil === 'Júnior'

  useEffect(() => {
    let vivo = true
    api<Projeto[]>('listar_projetos')
      .then((ps) => {
        if (!vivo) return
        setProjetos(ps)
        atualizarProjetos(ps)
      })
      .catch((e) => avisar(e instanceof Error ? e.message : 'Não foi possível carregar os sonhos', { tipo: 'erro' }))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [atualizarProjetos, avisar])

  const lista = ordenarProjetos(projetos)
  const ativos = lista.filter((p) => p.status !== 'concluído')
  const concluidos = lista.filter((p) => p.status === 'concluído')
  const totalGuardado = projetos.reduce((s, p) => s + (p.valor_atual ?? p.valor_inicial), 0)

  return (
    <>
      <Cabecalho titulo="Sonhos da Família" voltarPara="/" />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="card p-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primaria) 35%, var(--bg-card)), var(--bg-card))' }}>
          <span className="text-4xl" aria-hidden>✈️</span>
          <div className="flex-1">
            <div className="text-sm text-suave">Guardado para os sonhos</div>
            <div className="numero-grande">{moeda(totalGuardado)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/conselho" className="botao botao-secundario">🗳️ Conselho</Link>
          <Link to="/reuniao" className="botao botao-secundario">👨‍👩‍👧‍👦 Reunião</Link>
        </div>

        <button className="botao botao-primario w-full text-lg !min-h-14" onClick={() => setFormAberto(true)}>
          ✨ {ehJunior ? 'Criar meu sonho' : 'Novo sonho'}
        </button>
        {ehJunior && <p className="text-sm text-suave text-center -mt-2">Seu sonho entra com prioridade baixa; os pais podem ajustar depois.</p>}

        {carregando && !projetos.length ? (
          <Carregando texto="Buscando os sonhos…" />
        ) : !lista.length ? (
          <Vazio icone="🌱" titulo="Nenhum sonho ainda" texto="Comece pequeno: uma reserva, uma viagem, um presente. Toque em “Novo sonho”." />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {ativos.map((p) => <CartaoSonho key={p.id} p={p} />)}
            </div>
            {concluidos.length > 0 && (
              <>
                <h2 className="titulo-secao pt-2">🎉 Sonhos realizados</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {concluidos.map((p) => <CartaoSonho key={p.id} p={p} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <FormularioProjeto aberto={formAberto} aoFechar={() => setFormAberto(false)} aoSalvo={(_p, ps) => setProjetos(ps)} />
    </>
  )
}
