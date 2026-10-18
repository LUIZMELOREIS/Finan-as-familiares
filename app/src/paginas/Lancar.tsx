/**
 * /lancar — Lançar despesa, igual à referência: 4 métodos (Fotografar cupom,
 * Enviar fatura, Digitar, Falar), card com os dados à esquerda e o cardápio à
 * direita, com a sugestão já marcada e o rodapé "Lançar R$ X em Y".
 * Aceita ?modo=foto|fatura|digitar|falar, ?tipo=t_receitas e ?editar=ID (com
 * `location.state.lancamento`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ErroApi } from '../api/cliente'
import { competenciaDosFiltros, useBoot, useSessao } from '../store/sessao'
import type { Categoria, ContaAPagar, Lancamento, LeituraExtraida, OrigemLancamento, RegraLoja } from '../tipos'
import { dataBr, moeda } from '../util/formato'
import { extrairDeTexto } from '../util/extrator'
import { Cabecalho } from '../componentes/Cabecalho'
import { Icone } from '../componentes/Icone'
import { useLancarFrequentes } from '../hooks/useLancarFrequentes'
import { Cardapio, abaDe, type AbaCardapio } from '../componentes/lancar/Cardapio'
import { DadosDespesa } from '../componentes/lancar/DadosDespesa'
import { CapturaFoto } from '../componentes/lancar/CapturaFoto'
import { CapturaVoz } from '../componentes/lancar/CapturaVoz'
import { EnviarFatura } from '../componentes/lancar/EnviarFatura'
import { sugestaoDeCategoria } from '../componentes/lancar/comuns'
import { aplicarLeitura, paraLancamento, rascunhoDeLancamento, rascunhoVazio, type Rascunho } from '../componentes/lancar/rascunho'

type Modo = 'foto' | 'fatura' | 'digitar' | 'falar'
const MODOS: Modo[] = ['foto', 'fatura', 'digitar', 'falar']
const METODOS: Array<{ id: Modo; icone: string; titulo: string; texto: string; soAdulto?: boolean }> = [
  { id: 'foto', icone: 'camera', titulo: 'Fotografar cupom', texto: 'Lê valor, data e loja da foto' },
  { id: 'fatura', icone: 'file-text', titulo: 'Enviar fatura', texto: 'Luz, água, internet, cartão — PDF ou foto', soAdulto: true },
  { id: 'digitar', icone: 'keyboard', titulo: 'Digitar', texto: 'Valor e tipo em três toques' },
  { id: 'falar', icone: 'mic', titulo: 'Falar', texto: '“Gastei 45 na padaria no Pix”' },
]
const origemDe = (m: Modo): OrigemLancamento => (m === 'foto' ? 'foto' : m === 'falar' ? 'voz' : 'manual')
const FORMA_NOME: Record<string, string> = { pix: 'Pix', 'débito': 'Débito', 'crédito': 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto' }

export default function Lancar() {
  const boot = useBoot()
  const { usuario, usuarios, categorias, grupos, tipos, cartoes, contas_fixas, config, regras_loja } = boot
  const avisar = useSessao((e) => e.avisar)
  const filtros = useSessao((e) => e.filtros)
  const atualizarRegrasLoja = useSessao((e) => e.atualizarRegrasLoja)
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()

  const editarId = params.get('editar')
  const lancamentoEdicao = (loc.state as { lancamento?: Lancamento } | null)?.lancamento
  const editando = !!editarId && !!lancamentoEdicao && lancamentoEdicao.id === editarId
  const modoParam = params.get('modo') as Modo | null
  const ehDependente = usuario.perfil === 'Dependente'

  const [modo, setModo] = useState<Modo>(() => (editando ? 'digitar' : modoParam && MODOS.includes(modoParam) && !(modoParam === 'fatura' && ehDependente) ? modoParam : 'foto'))
  const [rascunho, setRascunho] = useState<Rascunho>(() => (editando ? rascunhoDeLancamento(lancamentoEdicao) : rascunhoVazio(usuario.id, origemDe(modo))))
  const [sugestao, setSugestao] = useState<string | undefined>(() => (editando ? lancamentoEdicao.categoria_id : undefined))
  const [aba, setAba] = useState<AbaCardapio>(() => (editando ? abaDe(categorias.find((c) => c.id === lancamentoEdicao.categoria_id)) : params.get('tipo') === 't_receitas' ? 't_receitas' : 't_variaveis'))
  const [lido, setLido] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [pronto, setPronto] = useState<Lancamento[] | null>(null)
  const { frequentes, registrar } = useLancarFrequentes(usuario.id, categorias)

  const mudar = useCallback((p: Partial<Rascunho>) => setRascunho((r) => ({ ...r, ...p })), [])
  const categoria = useMemo(() => categorias.find((c) => c.id === rascunho.categoria_id), [categorias, rascunho.categoria_id])
  const categoriaSugerida = useMemo(() => categorias.find((c) => c.id === sugestao), [categorias, sugestao])
  const ehReceita = categoria ? categoria.tipo === 'receita' : aba === 't_receitas'

  // ?editar= sem o lançamento no state (recarregou a página): volta ao Painel.
  useEffect(() => { if (editarId && !lancamentoEdicao) nav('/', { replace: true }) }, [editarId, lancamentoEdicao, nav])
  // Troca de modo pela URL (ex.: botão da barra inferior enquanto já está na tela).
  useEffect(() => { if (modoParam && MODOS.includes(modoParam) && !editando) setModo(modoParam) }, [modoParam, editando])

  function mudarModo(m: Modo) {
    setModo(m)
    // Depois de "Lançado", trocar de método começa um lançamento novo (sem herdar valor, cartão e parcelas).
    if (pronto) { setRascunho(rascunhoVazio(usuario.id, origemDe(m))); setSugestao(undefined); setLido(false) }
    else if (!editando) mudar({ origem: origemDe(m) })
    setPronto(null)
  }

  /** Aplica uma leitura (cupom, NFC-e, voz) e marca a sugestão no cardápio. */
  const aplicar = useCallback((le: LeituraExtraida, origem: OrigemLancamento, textoBase?: string, previa?: string) => {
    setRascunho((r) => {
      const base = aplicarLeitura(r, le, origem)
      const ehRec = (le.categoria_id && categorias.find((c) => c.id === le.categoria_id)?.tipo === 'receita') || /recebi|entrou|ganhei|sal[aá]rio|pagaram/i.test(textoBase || '')
      const sug = sugestaoDeCategoria(textoBase || le.estabelecimento || le.descricao, le.categoria_id, regras_loja, categorias, ehRec ? 'receita' : 'despesa')
      setSugestao(sug)
      const cat = categorias.find((c) => c.id === sug)
      if (cat) setAba(abaDe(cat))
      return { ...base, previa: previa ?? base.previa, categoria_id: sug ?? base.categoria_id }
    })
  }, [categorias, regras_loja])

  function aoLerFoto(le: LeituraExtraida, previa: string) {
    aplicar(le, 'foto', undefined, previa)
    setLido(true)
  }

  function aoTextoVoz(texto: string) {
    aplicar(extrairDeTexto(texto, categorias), 'voz', texto)
    setLido(true)
    // Refina no servidor (regras da loja / Claude) sem travar a tela.
    api<LeituraExtraida>('ler_texto', { texto, tipo: 'voz' })
      .then((le) => { if (le.valor || le.categoria_id) aplicar({ ...le, anexo_url: undefined }, 'voz', texto) })
      .catch(() => { /* fica com a leitura local */ })
  }

  const podeConfirmar = rascunho.valor > 0 && !!categoria

  async function confirmar() {
    if (!rascunho.valor) { avisar('Informe o valor.', { tipo: 'erro' }); return }
    if (!categoria) { avisar('Escolha a despesa no cardápio.', { tipo: 'erro' }); return }
    setSalvando(true)
    const lancamento = paraLancamento(rascunho, categoria)
    const aprenderLoja = !!rascunho.estabelecimento && !!sugestao && sugestao !== categoria.id
    try {
      const resultado = await api<Lancamento[] | Lancamento>('salvar_lancamento', {
        lancamento, parcelas: rascunho.parcelas > 1 && !editando ? rascunho.parcelas : undefined, aprender_loja: aprenderLoja,
      })
      concluir(Array.isArray(resultado) ? resultado : [resultado], categoria, aprenderLoja)
    } catch (e) {
      if (e instanceof ErroApi && e.offline) {
        avisar(e.message, { tipo: 'info', duracao: 6000 })
        concluir([lancamento], categoria, false)
      } else avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  function concluir(lista: Lancamento[], cat: Categoria, aprendeu: boolean) {
    registrar(cat.id)
    if (aprendeu) api<RegraLoja[]>('listar_regras_loja').then(atualizarRegrasLoja).catch(() => {})
    if (editando) { avisar('Alterações salvas', { tipo: 'ok' }); nav(-1); return }
    avisar(`Lançado: ${moeda(rascunho.valor)} em ${cat.nome}`, {
      tipo: 'ok',
      desfazer: async () => {
        await Promise.all(lista.filter((l) => l.id).map((l) => api('excluir_lancamento', { id: l.id }).catch(() => {})))
        avisar('Lançamento desfeito', { tipo: 'info' })
        setPronto(null)
      },
    })
    setPronto(lista)
  }

  function lancarOutro() {
    setRascunho(rascunhoVazio(usuario.id, origemDe(modo)))
    setSugestao(undefined)
    setLido(false)
    setPronto(null)
  }

  function aoSalvarFatura(_conta: ContaAPagar) {
    nav('/contas')
  }

  const metodos = METODOS.filter((m) => !(m.soAdulto && ehDependente))

  return (
    <>
      <Cabecalho titulo={editando ? 'Editar lançamento' : 'Lançar despesa'} subtitulo={editando ? 'Corrija o que for preciso e salve.' : 'Escolha como lançar. O tipo de despesa vem do cardápio abaixo.'} voltarPara={editando ? '' : undefined} />

      {!editando && (
        <div className="methods">
          {metodos.map((m) => (
            <button key={m.id} type="button" className="method" aria-pressed={modo === m.id} onClick={() => mudarModo(m.id)}>
              <Icone nome={m.icone} tamanho={22} /><b>{m.titulo}</b><small>{m.texto}</small>
            </button>
          ))}
        </div>
      )}

      {pronto ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>Lançado <span className="tag ok">confirmado</span></h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            <b className="num" style={{ color: 'var(--text)', fontWeight: 600 }}>{moeda(rascunho.valor)}</b> em <b style={{ color: 'var(--text)', fontWeight: 600 }}>{categoria?.nome}</b>
            {pronto.length > 1 && <> · {pronto.length} parcelas</>} · {dataBr(rascunho.data)} · {FORMA_NOME[rascunho.forma_pgto] ?? rascunho.forma_pgto} · por {usuarios.find((u) => u.id === rascunho.usuario_id)?.apelido}
          </p>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={lancarOutro}><Icone nome="circle-plus" />Lançar outro</button>
            <Link to="/" className="btn btn-ghost"><Icone nome="layout-grid" />Voltar ao Painel</Link>
          </div>
        </div>
      ) : modo === 'fatura' ? (
        <div className="entry" style={{ gridTemplateColumns: 'minmax(0, 640px)' }}>
          <div className="card">
            <h3>Dados lidos da fatura <span className="sub">PDF ou foto</span></h3>
            <EnviarFatura contasFixas={contas_fixas} competenciaPadrao={competenciaDosFiltros(filtros)} avisar={avisar} aoSalvar={aoSalvarFatura} autoAbrir={modoParam === 'fatura'} />
          </div>
        </div>
      ) : (
        <div className="entry">
          <DadosDespesa
            titulo={modo === 'foto' ? 'Dados lidos do cupom' : editando ? 'Dados do lançamento' : 'Dados da despesa'}
            lido={lido}
            topo={modo === 'foto' ? <CapturaFoto aoLer={aoLerFoto} aoErro={(m) => avisar(m, { tipo: 'erro' })} autoAbrir={modoParam === 'foto'} /> : modo === 'falar' ? <CapturaVoz aoTexto={aoTextoVoz} /> : undefined}
            rascunho={rascunho}
            aoMudar={mudar}
            cartoes={cartoes}
            usuarios={usuarios}
            usuarioAtual={usuario}
            valorGastoGrande={config.valor_gasto_grande}
            editando={editando}
            ehReceita={ehReceita}
            autoFocoValor={modo === 'digitar' && !editando}
          />
          <div className="card">
            <h3>{ehReceita ? 'Qual é a receita?' : 'Qual é a despesa?'} {categoriaSugerida && <span className="sub">sugestão: {categoriaSugerida.nome}</span>}</h3>
            <Cardapio tipos={tipos} grupos={grupos} categorias={categorias} frequentes={frequentes} escolhida={rascunho.categoria_id} aoEscolher={(c) => { mudar({ categoria_id: c.id }); setAba(abaDe(c)) }} aba={aba} aoMudarAba={setAba} />
            <div className="confirm">
              <p>
                {podeConfirmar
                  ? <>Lançar <b className="num">{moeda(rascunho.valor)}</b> em <b>{categoria!.nome}</b>{rascunho.parcelas > 1 && rascunho.forma_pgto === 'crédito' && !editando && <> · <span className="num">{rascunho.parcelas}x</span></>}</>
                  : !rascunho.valor ? 'Informe o valor para continuar.' : 'Escolha a despesa no cardápio.'}
              </p>
              <button type="button" className="btn btn-primary" onClick={confirmar} disabled={!podeConfirmar || salvando}>
                <Icone nome="check" />{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Confirmar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
