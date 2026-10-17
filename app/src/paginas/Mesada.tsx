import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cabecalho } from '../componentes/Cabecalho'
import { Carregando, Vazio } from '../componentes/Carregando'
import { Folha } from '../componentes/Folha'
import { Avatar } from '../componentes/familia/Avatar'
import { BarraProgresso } from '../componentes/familia/BarraProgresso'
import { FolhaAporte } from '../componentes/familia/FolhaAporte'
import { SeletorMes } from '../componentes/familia/SeletorMes'
import { LUCAS_16_10, PROVERBIOS_13_11, versiculoPorReferencia } from '../componentes/familia/versiculos'
import { api } from '../api/cliente'
import { categoriaPorId, useBoot, useSessao } from '../store/sessao'
import { competenciaDe, dataBr, moeda } from '../util/formato'
import type { Lancamento, Projeto, Usuario } from '../tipos'

interface DadosMesada {
  mesada_mensal: number
  gasto: number
  saldo: number
  cofrinho: number
}

export default function Mesada() {
  const boot = useBoot()
  const nav = useNavigate()
  const avisar = useSessao((e) => e.avisar)
  const atualizarProjetos = useSessao((e) => e.atualizarProjetos)
  const ehJunior = boot.usuario.perfil === 'Júnior'
  const filhos = useMemo(() => boot.usuarios.filter((u) => u.perfil === 'Júnior' && u.ativo), [boot.usuarios])
  const [alvoId, setAlvoId] = useState<string>(ehJunior ? boot.usuario.id : filhos[0]?.id ?? '')
  const [competencia, setCompetencia] = useState(competenciaDe())
  const [dados, setDados] = useState<DadosMesada | null>(null)
  const [gastos, setGastos] = useState<Lancamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [escolhendoSonho, setEscolhendoSonho] = useState(false)
  const [projetoAporte, setProjetoAporte] = useState<Projeto | null>(null)
  const [versao, setVersao] = useState(0)
  const alvo: Usuario | undefined = boot.usuarios.find((u) => u.id === alvoId)
  const feAtiva = boot.config.fe_ativa
  const versiculo = versiculoPorReferencia(Number(competencia.slice(5)) % 2 === 0 ? PROVERBIOS_13_11 : LUCAS_16_10)
  const sonhosAtivos = boot.projetos.filter((p) => p.status === 'ativo')

  useEffect(() => {
    if (!alvoId) { setCarregando(false); return }
    let vivo = true
    setCarregando(true)
    Promise.all([
      api<DadosMesada>('mesada', { usuario_id: alvoId, competencia }),
      api<Lancamento[]>('listar_lancamentos', { competencia, usuario_id_filtro: alvoId }),
    ])
      .then(([m, ls]) => {
        if (!vivo) return
        setDados(m)
        setGastos(ls.filter((l) => l.tipo === 'despesa' && l.usuario_id === alvoId && !l.excluido).sort((a, b) => (a.data < b.data ? 1 : -1)))
      })
      .catch((e) => avisar(e instanceof Error ? e.message : 'Não foi possível carregar a mesada', { tipo: 'erro' }))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [alvoId, competencia, versao, avisar])

  const pctGasto = dados && dados.mesada_mensal > 0 ? Math.min(100, (dados.gasto / dados.mesada_mensal) * 100) : 0
  const positivo = (dados?.saldo ?? 0) >= 0

  const aoAportado = async () => {
    atualizarProjetos(await api<Projeto[]>('listar_projetos'))
    setVersao((v) => v + 1)
    avisar('Guardado no cofrinho! Quem é fiel no pouco…', { tipo: 'ok' })
  }

  return (
    <>
      <Cabecalho titulo={ehJunior ? 'Minha mesada' : 'Mesada Júnior'} voltarPara="/" acao={!ehJunior ? <Link to="/configuracoes/membros" className="botao botao-fantasma !px-2">⚙️ <span className="text-sm">Ajustar</span></Link> : undefined} />
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {!ehJunior && (
          filhos.length === 0 ? (
            <Vazio icone="🧒" titulo="Nenhum membro Júnior ainda" texto="Convide os filhos em Configurações › Membros e defina a mesada de cada um.">
              <Link to="/configuracoes/membros" className="botao botao-primario">👨‍👩‍👧 Ir para Membros</Link>
            </Vazio>
          ) : (
            <div className="flex gap-2 overflow-x-auto rolagem-escondida py-1" role="tablist" aria-label="Escolher o filho">
              {filhos.map((f) => (
                <button key={f.id} role="tab" aria-selected={f.id === alvoId} className={`botao ${f.id === alvoId ? 'botao-primario' : 'botao-secundario'} shrink-0`} onClick={() => setAlvoId(f.id)}>
                  <Avatar usuario={f} tamanho={28} /> {f.apelido}
                </button>
              ))}
            </div>
          )
        )}

        {alvo && (
          <>
            <SeletorMes competencia={competencia} aoMudar={setCompetencia} maxima={competenciaDe()} />

            {carregando && !dados ? (
              <Carregando texto="Contando as moedinhas…" />
            ) : dados && (
              <>
                <div className="card p-5 space-y-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${positivo ? 'var(--verde)' : 'var(--vermelho)'} 28%, var(--bg-card)), var(--bg-card))` }}>
                  <div className="flex items-center gap-3">
                    <Avatar usuario={alvo} tamanho={48} />
                    <div>
                      <div className="text-sm text-suave">{ehJunior ? 'Você ainda tem para gastar' : `${alvo.apelido} ainda tem para gastar`}</div>
                      <div className={`numero-grande ${positivo ? 'text-verde' : 'text-vermelho'}`} style={{ fontSize: '2.4rem' }}>{moeda(dados.saldo)}</div>
                    </div>
                  </div>
                  <BarraProgresso pct={pctGasto} altura={16} cor={pctGasto >= 100 ? 'var(--vermelho)' : pctGasto >= 75 ? 'var(--amarelo)' : 'var(--verde)'} />
                  <div className="flex justify-between text-sm">
                    <span>Gastou <strong>{moeda(dados.gasto)}</strong></span>
                    <span className="text-suave">Mesada: <strong className="text-texto">{moeda(dados.mesada_mensal)}</strong></span>
                  </div>
                  {!positivo && <p className="text-sm">Passou um pouquinho este mês. Tudo bem — o próximo mês é uma nova chance de planejar melhor.</p>}
                </div>

                <Link to="/sonhos" className="card card-toque p-4 flex items-center gap-4">
                  <span className="text-4xl" aria-hidden>🐷</span>
                  <div className="flex-1">
                    <div className="text-sm text-suave">Cofrinho (guardado nos sonhos)</div>
                    <div className="numero-grande text-amarelo">{moeda(dados.cofrinho)}</div>
                  </div>
                  <span className="text-suave" aria-hidden>›</span>
                </Link>

                {feAtiva && versiculo && (
                  <p className="text-sm text-suave italic leading-relaxed px-1">“{versiculo.texto}” — {versiculo.referencia}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button className="botao botao-primario !min-h-16 flex-col !gap-0" onClick={() => nav('/lancar')}>
                    <span className="text-2xl leading-none" aria-hidden>🧾</span><span>Lançar um gasto</span>
                  </button>
                  {ehJunior ? (
                    <button className="botao botao-amarelo !min-h-16 flex-col !gap-0" onClick={() => setEscolhendoSonho(true)} disabled={!sonhosAtivos.length}>
                      <span className="text-2xl leading-none" aria-hidden>🐷</span><span>Guardar no cofrinho</span>
                    </button>
                  ) : (
                    <Link to="/configuracoes/membros" className="botao botao-secundario !min-h-16 flex-col !gap-0">
                      <span className="text-2xl leading-none" aria-hidden>⚙️</span><span>Ajustar mesada</span>
                    </Link>
                  )}
                </div>
                {!ehJunior && <p className="text-xs text-suave text-center -mt-1">O cofrinho é alimentado pelo próprio filho, em "Guardar no cofrinho" no app dele.</p>}

                <div className="card p-4">
                  <h2 className="font-bold mb-2">Gastos do mês ({gastos.length})</h2>
                  {gastos.length === 0 ? (
                    <p className="text-suave">Nenhum gasto registrado neste mês.</p>
                  ) : (
                    <ul className="divide-y divide-borda">
                      {gastos.map((l) => {
                        const c = categoriaPorId(boot.categorias, l.categoria_id)
                        const ehAporte = !!l.projeto_id
                        return (
                          <li key={l.id} className="flex items-center gap-3 py-3">
                            <span className="text-2xl w-9 text-center shrink-0" aria-hidden>{ehAporte ? '🐷' : c?.icone ?? '🧾'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{l.descricao || l.estabelecimento || c?.nome || 'Gasto'}</div>
                              <div className="text-sm text-suave">{dataBr(l.data)} · {ehAporte ? 'Cofrinho' : c?.nome ?? ''}</div>
                            </div>
                            <div className={`font-bold whitespace-nowrap ${ehAporte ? 'text-amarelo' : ''}`}>{moeda(l.valor)}</div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Folha aberta={escolhendoSonho} aoFechar={() => setEscolhendoSonho(false)} titulo="🐷 Guardar em qual sonho?">
        <div className="space-y-2">
          {sonhosAtivos.map((p) => (
            <button key={p.id} className="card card-toque w-full flex items-center gap-3 p-3 text-left" onClick={() => { setEscolhendoSonho(false); setProjetoAporte(p) }}>
              <span className="text-3xl" aria-hidden>{p.icone}</span>
              <span className="flex-1 min-w-0">
                <span className="font-bold block truncate">{p.nome}</span>
                <span className="text-sm text-suave">{moeda(p.valor_atual ?? p.valor_inicial)} de {moeda(p.meta_valor)}</span>
              </span>
              <span className="text-suave" aria-hidden>›</span>
            </button>
          ))}
        </div>
      </Folha>
      <FolhaAporte aberta={!!projetoAporte} aoFechar={() => setProjetoAporte(null)} projeto={projetoAporte} aoAportado={aoAportado} />
    </>
  )
}
