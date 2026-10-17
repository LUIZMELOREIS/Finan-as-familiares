/**
 * /lancar — o coração do app. Tela cheia (sem Layout). Máximo 3 toques:
 *  Passo 0: 📷 Fotografar cupom · 🎤 Falar o gasto · ⌨️ Digitar
 *  Foto → lê cupom (QR da NFC-e ou Claude) → confirmação
 *  Voz → extrator local (+ ler_texto no servidor) → confirmação
 *  Digitar → teclado numérico → grade de categorias → confirmação
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ErroApi } from '../api/cliente'
import { useBoot, useSessao } from '../store/sessao'
import type { Lancamento, LeituraExtraida, TipoLancamento } from '../tipos'
import { moeda } from '../util/formato'
import { extrairDeTexto } from '../util/extrator'
import { Avisos } from '../componentes/Avisos'
import { useCategoriasFrequentes } from '../hooks/useCategoriasFrequentes'
import { TecladoValor } from '../componentes/lancar/TecladoValor'
import { GradeCategorias } from '../componentes/lancar/GradeCategorias'
import { CapturaFoto } from '../componentes/lancar/CapturaFoto'
import { CapturaVoz } from '../componentes/lancar/CapturaVoz'
import { Confirmacao } from '../componentes/lancar/Confirmacao'
import { aplicarLeitura, paraLancamento, rascunhoDeLancamento, rascunhoVazio, type Rascunho } from '../componentes/lancar/rascunho'

type Passo = 'escolha' | 'foto' | 'voz' | 'valor' | 'categoria' | 'confirmar' | 'pronto'

const TITULOS: Record<Passo, string> = {
  escolha: 'Lançar', foto: 'Fotografar cupom', voz: 'Falar o gasto', valor: 'Digitar o valor', categoria: 'Escolher a categoria', confirmar: 'Confirmar', pronto: 'Lançado!',
}

export default function Lancar() {
  const boot = useBoot()
  const sessao = useSessao((e) => e.sessao)
  const avisar = useSessao((e) => e.avisar)
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const { usuario, categorias, grupos, cartoes, usuarios, config } = boot

  const editarId = params.get('editar')
  const lancamentoEdicao = (loc.state as { lancamento?: Lancamento } | null)?.lancamento
  const editando = !!editarId && !!lancamentoEdicao && lancamentoEdicao.id === editarId

  const tipoInicial: TipoLancamento = params.get('tipo') === 'receita' ? 'receita' : 'despesa'
  const modoInicial = params.get('modo')
  const passoInicial: Passo = editando ? 'confirmar' : modoInicial === 'foto' ? 'foto' : modoInicial === 'voz' ? 'voz' : modoInicial === 'digitar' ? 'valor' : 'escolha'

  const [passo, setPasso] = useState<Passo>(passoInicial)
  const [rascunho, setRascunho] = useState<Rascunho>(() => (editando ? rascunhoDeLancamento(lancamentoEdicao) : rascunhoVazio(usuario.id, tipoInicial)))
  const [salvando, setSalvando] = useState(false)
  const [criados, setCriados] = useState<Lancamento[]>([])

  const { frequentes, registrar } = useCategoriasFrequentes(usuario.id, categorias, rascunho.tipo)
  const mudar = useCallback((p: Partial<Rascunho>) => setRascunho((r) => ({ ...r, ...p })), [])

  // Se veio ?editar= sem o lançamento no state (ex.: recarregou a página), volta.
  useEffect(() => { if (editarId && !lancamentoEdicao) nav('/', { replace: true }) }, [editarId, lancamentoEdicao, nav])

  // Tecla Esc / botão voltar do navegador voltam um passo.
  const voltar = useCallback(() => {
    if (passo === 'escolha' || editando || passo === 'pronto') { if (window.history.length > 1) nav(-1); else nav('/'); return }
    if (passo === 'confirmar') setPasso(rascunho.origem === 'foto' ? 'foto' : rascunho.origem === 'voz' ? 'voz' : 'categoria')
    else if (passo === 'categoria') setPasso('valor')
    else setPasso('escolha')
  }, [passo, editando, nav, rascunho.origem])

  const ehDemo = !sessao?.url_api

  // --- Foto ---
  function aoLerFoto(le: LeituraExtraida, previa: string) {
    setRascunho((r) => ({ ...aplicarLeitura(r, le, 'foto'), previa: previa || r.previa, forma_pgto: le.forma_pgto ?? r.forma_pgto }))
    setPasso('confirmar')
  }

  // --- Voz ---
  async function aoTextoVoz(texto: string) {
    const local = extrairDeTexto(texto, categorias)
    const ehReceita = /recebi|entrou|ganhei|salário|salario|pagaram/i.test(texto)
    setRascunho((r) => ({ ...aplicarLeitura({ ...r, tipo: ehReceita ? 'receita' : 'despesa' }, local, 'voz'), descricao: local.descricao || r.descricao }))
    setPasso('confirmar')
    if (!ehDemo) {
      // Refina no servidor (Claude) sem travar a tela.
      api<LeituraExtraida>('ler_texto', { texto, tipo: 'voz' })
        .then((le) => setRascunho((r) => (r.origem === 'voz' ? aplicarLeitura(r, { ...le, anexo_url: undefined }, 'voz') : r)))
        .catch(() => { /* fica com a leitura local */ })
    }
  }

  // --- Salvar ---
  async function confirmar() {
    setSalvando(true)
    const lancamento = paraLancamento(rascunho)
    try {
      const resultado = await api<Lancamento[]>('salvar_lancamento', { lancamento, parcelas: rascunho.parcelas > 1 && !rascunho.id ? rascunho.parcelas : undefined })
      const lista = Array.isArray(resultado) ? resultado : [resultado as unknown as Lancamento]
      setCriados(lista)
      registrar(rascunho.categoria_id)
      if (editando) {
        avisar('Alterações salvas', { tipo: 'ok' })
        nav(-1)
        return
      }
      avisar(`${rascunho.tipo === 'receita' ? 'Entrada' : 'Gasto'} de ${moeda(rascunho.valor)} lançado`, {
        tipo: 'ok',
        desfazer: async () => {
          await Promise.all(lista.map((l) => api('excluir_lancamento', { id: l.id })))
          setCriados([])
        },
      })
      setPasso('pronto')
    } catch (e) {
      if (e instanceof ErroApi && e.offline) {
        avisar(e.message, { tipo: 'info', duracao: 6000 })
        registrar(rascunho.categoria_id)
        if (editando) { nav(-1); return }
        setPasso('pronto')
      } else {
        avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
      }
    } finally {
      setSalvando(false)
    }
  }

  function lancarOutro() {
    setRascunho(rascunhoVazio(usuario.id, rascunho.tipo))
    setCriados([])
    setPasso('escolha')
  }

  const categoria = useMemo(() => categorias.find((c) => c.id === rascunho.categoria_id), [categorias, rascunho.categoria_id])

  return (
    <div className="min-h-dvh flex flex-col bg-painel">
      <header className="area-segura-topo sticky top-0 z-30 bg-painel/90 backdrop-blur border-b border-borda">
        <div className="max-w-xl mx-auto flex items-center gap-2 px-3 py-2">
          <button className="botao botao-fantasma !px-2" onClick={voltar} aria-label="Voltar">
            <span className="text-xl" aria-hidden>‹</span> <span className="text-sm">Voltar</span>
          </button>
          <h1 className="flex-1 text-lg font-bold truncate text-center">{editando ? 'Editar lançamento' : TITULOS[passo]}</h1>
          <Link to="/" className="botao botao-fantasma !px-2" aria-label="Fechar e voltar ao início"><span className="text-xl" aria-hidden>✕</span></Link>
        </div>
        {!editando && passo !== 'escolha' && passo !== 'pronto' && (
          <div className="max-w-xl mx-auto px-3 pb-2 flex gap-1" aria-hidden>
            {['captura', 'detalhes', 'confirmar'].map((e, i) => {
              const atual = passo === 'confirmar' ? 2 : passo === 'categoria' ? 1 : 0
              return <span key={e} className={`h-1.5 flex-1 rounded-full ${i <= atual ? 'bg-primaria-sel' : 'bg-borda'}`} />
            })}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col max-w-xl w-full mx-auto p-4">
        {passo === 'escolha' && (
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <p className="text-center text-suave">Como você quer lançar?</p>
            {[
              { p: 'foto' as Passo, icone: '📷', titulo: 'Fotografar cupom', texto: 'A gente lê o valor, a loja e a data' },
              { p: 'voz' as Passo, icone: '🎤', titulo: 'Falar o gasto', texto: '“Gastei 45 reais na padaria no pix”' },
              { p: 'valor' as Passo, icone: '⌨️', titulo: 'Digitar', texto: 'Valor, categoria e pronto' },
            ].map((o) => (
              <button key={o.p} type="button" className="card card-toque flex items-center gap-4 p-5 min-h-28 text-left" onClick={() => { mudar({ origem: o.p === 'valor' ? 'manual' : o.p === 'foto' ? 'foto' : 'voz' }); setPasso(o.p) }}>
                <span className="text-5xl w-16 text-center" aria-hidden>{o.icone}</span>
                <span className="flex-1">
                  <span className="block font-bold text-xl">{o.titulo}</span>
                  <span className="block text-sm text-suave">{o.texto}</span>
                </span>
                <span className="text-2xl text-suave" aria-hidden>›</span>
              </button>
            ))}
            <Link to={`/lancar?modo=digitar&tipo=${rascunho.tipo === 'receita' ? 'despesa' : 'receita'}`} onClick={() => { mudar({ tipo: rascunho.tipo === 'receita' ? 'despesa' : 'receita', origem: 'manual' }); setPasso('valor') }} className="botao botao-fantasma w-full">
              <span aria-hidden>{rascunho.tipo === 'receita' ? '🛒' : '💰'}</span> {rascunho.tipo === 'receita' ? 'Lançar uma despesa' : 'Lançar uma entrada (salário, mesada…)'}
            </Link>
          </div>
        )}

        {passo === 'foto' && <CapturaFoto aoLer={aoLerFoto} aoCancelar={() => setPasso('escolha')} />}
        {passo === 'voz' && <CapturaVoz aoTexto={aoTextoVoz} aoCancelar={() => setPasso('escolha')} />}

        {passo === 'valor' && (
          <TecladoValor
            valorInicial={rascunho.valor}
            tipo={rascunho.tipo}
            aoMudarTipo={(t) => mudar({ tipo: t, categoria_id: '' })}
            aoContinuar={(v) => { mudar({ valor: v, origem: 'manual' }); setPasso('categoria') }}
          />
        )}

        {passo === 'categoria' && (
          <GradeCategorias
            valor={rascunho.valor}
            tipo={rascunho.tipo}
            frequentes={frequentes}
            categorias={categorias}
            grupos={grupos}
            aoEscolher={(c) => { mudar({ categoria_id: c.id }); setPasso('confirmar') }}
            aoVoltar={() => setPasso('valor')}
          />
        )}

        {passo === 'confirmar' && (
          <Confirmacao
            rascunho={rascunho}
            aoMudar={mudar}
            categorias={categorias}
            grupos={grupos}
            cartoes={cartoes}
            usuarios={usuarios}
            usuarioAtual={usuario}
            valorGastoGrande={config.valor_gasto_grande}
            salvando={salvando}
            editando={editando}
            aoConfirmar={confirmar}
            aoVoltar={voltar}
          />
        )}

        {passo === 'pronto' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center">
            <div className="w-28 h-28 rounded-full bg-verde/20 flex items-center justify-center text-6xl" aria-hidden>✅</div>
            <div>
              <div className="text-2xl font-extrabold">Lançado!</div>
              <div className="text-suave mt-1">
                {rascunho.tipo === 'receita' ? 'Entrada' : 'Gasto'} de <b className="text-texto">{moeda(rascunho.valor)}</b>
                {categoria && <> em <b className="text-texto">{categoria.icone} {categoria.nome}</b></>}
                {criados.length > 1 && <> · {criados.length} parcelas</>}
              </div>
              {config.fe_ativa && <p className="text-sm text-suave italic mt-3 max-w-xs mx-auto">“Quem é fiel no pouco, também é fiel no muito.” — Lucas 16:10</p>}
            </div>
            <div className="w-full max-w-sm space-y-3">
              <button type="button" className="botao botao-primario !min-h-16 text-lg w-full" onClick={lancarOutro}><span aria-hidden>➕</span> Lançar outro</button>
              <Link to="/" className="botao botao-secundario !min-h-14 w-full"><span aria-hidden>🏠</span> Voltar ao início</Link>
            </div>
          </div>
        )}
      </main>
      <Avisos />
    </div>
  )
}
