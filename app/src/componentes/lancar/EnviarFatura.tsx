/**
 * Enviar fatura (luz, água, gás, internet, telefone, plano de saúde, escola):
 * PDF ou foto → campos conferíveis → "Salvar conta a pagar" (com a opção de já
 * lançar como paga). Usado na tela Lançar e em Contas.
 *
 * Leitura: um PDF com texto é lido aqui no aparelho (pdf.js + regras); em paralelo
 * o servidor (`ler_imagem`) guarda o anexo no Drive e, se tiver chave do Claude,
 * melhora a leitura. Fotos dependem do servidor.
 *
 * Conta fixa: se nenhuma das cadastradas casar, o administrador pode criar uma
 * nova ali mesmo ("Nova conta fixa…"); os demais podem salvar sem conta fixa.
 */
import { useEffect, useRef, useState } from 'react'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { Categoria, ContaAPagar, ContaFixa, FormaPgto, LeituraExtraida } from '../../tipos'
import { competenciaDe, dataBr, dataIso, hojeIso, lerValor, nomeCompetencia, normalizar, numero, somarMeses } from '../../util/formato'
import { casarContaFixa, explicarErroDeLeitura, lerFaturaDeTexto, mesclarLeituras, textoDoPdf } from '../../util/fatura'
import { Icone } from '../Icone'

/** Valor especial do select "Conta fixa" que abre o cadastro de uma nova. */
export const NOVA_CONTA_FIXA = '__nova__'

interface Campos {
  empresa: string
  conta_fixa_id: string
  competencia: string
  valor: string
  vencimento: string // dd/mm/aaaa
  consumo_valor: string
  consumo_unidade: string
  linha_digitavel: string
  pix_copia_cola: string
  anexo_url: string
}

interface NovaFixa {
  nome: string
  categoria_id: string
}

const FORMAS: Array<{ id: FormaPgto; nome: string }> = [
  { id: 'pix', nome: 'Pix' }, { id: 'débito', nome: 'Débito' }, { id: 'crédito', nome: 'Crédito' }, { id: 'dinheiro', nome: 'Dinheiro' }, { id: 'boleto', nome: 'Boleto' },
]

export function EnviarFatura({ contasFixas, categorias = [], podeCriarContaFixa = false, aoCriarContaFixa, competenciaPadrao, avisar, aoSalvar, aoLer, autoAbrir, arquivoInicial }: {
  /** PDF ou imagem que chegou por compartilhamento de outro app: é lido ao montar. */
  arquivoInicial?: File | null
  contasFixas: ContaFixa[]
  /** Cardápio de categorias (para sugerir a categoria da nova conta fixa). */
  categorias?: Categoria[]
  /** Só o Administrador pode cadastrar contas fixas (regra do servidor). */
  podeCriarContaFixa?: boolean
  /** Chamado quando uma conta fixa é criada aqui, para atualizar a lista da sessão. */
  aoCriarContaFixa?: (conta: ContaFixa) => void
  competenciaPadrao: string
  avisar: (texto: string, opcoes?: { tipo?: 'ok' | 'erro' | 'info' }) => void
  aoSalvar: (conta: ContaAPagar, pagaAgora: boolean) => void
  aoLer?: (leitura: LeituraExtraida) => void
  autoAbrir?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [lido, setLido] = useState(false)
  const [arquivoNome, setArquivoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pagarAgora, setPagarAgora] = useState(false)
  const [forma, setForma] = useState<FormaPgto>('pix')
  const [anexando, setAnexando] = useState(false)
  const [c, setC] = useState<Campos>({ empresa: '', conta_fixa_id: '', competencia: competenciaPadrao, valor: '', vencimento: dataBr(hojeIso()), consumo_valor: '', consumo_unidade: '', linha_digitavel: '', pix_copia_cola: '', anexo_url: '' })
  const [nova, setNova] = useState<NovaFixa>({ nome: '', categoria_id: '' })
  const m = <K extends keyof Campos>(k: K, v: string) => setC((a) => ({ ...a, [k]: v }))
  const ativas = contasFixas.filter((f) => f.ativa !== false)
  const categoriasFixas = categorias.filter((k) => k.tipo === 'despesa' && k.fixa && k.ativa !== false)
  const criandoFixa = c.conta_fixa_id === NOVA_CONTA_FIXA
  // Sem nenhuma conta fixa cadastrada, o administrador já cai direto no cadastro da primeira.
  useEffect(() => { if (podeCriarContaFixa && ativas.length === 0) setC((a) => (a.conta_fixa_id ? a : { ...a, conta_fixa_id: NOVA_CONTA_FIXA })) }, [podeCriarContaFixa, ativas.length])
  useEffect(() => { if (autoAbrir) inputRef.current?.click() }, [autoAbrir])
  useEffect(() => { if (arquivoInicial) void aoEscolherArquivo(arquivoInicial) }, [arquivoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  function escolherContaFixa(id: string) {
    const cf = ativas.find((f) => f.id === id)
    if (id === NOVA_CONTA_FIXA) setNova((n) => ({ nome: n.nome || c.empresa, categoria_id: n.categoria_id || sugerirCategoriaFixa(c.empresa) }))
    setC((a) => ({
      ...a, conta_fixa_id: id,
      empresa: a.empresa || cf?.nome || '',
      valor: a.valor || (cf ? numero(cf.valor_previsto) : ''),
      vencimento: cf && !lido ? dataBr(`${a.competencia}-${String(cf.dia_vencimento).padStart(2, '0')}`) : a.vencimento,
    }))
  }

  function sugerirCategoriaFixa(texto: string): string {
    const l = lerFaturaDeTexto(texto, { categorias })
    return l.categoria_id && categoriasFixas.some((k) => k.id === l.categoria_id) ? l.categoria_id : ''
  }

  /** Preenche os campos a partir de uma leitura (do aparelho, do servidor ou das duas juntas). */
  function aplicarLeitura(l: LeituraExtraida) {
    const emp = normalizar(l.empresa ?? '')
    const casada = ativas.find((f) => f.id === l.conta_fixa_id)
      ?? casarContaFixa(l.empresa ?? '', l.empresa, ativas)
      ?? ativas.find((f) => emp && (normalizar(f.nome).split(' ')[0] === emp.split(' ')[0] || (f.remetente_email && emp.includes(normalizar(f.remetente_email).split(' ')[0]))))
    const competencia = l.competencia ?? competenciaPadrao
    const semFixa = !casada && podeCriarContaFixa
    setC({
      empresa: l.empresa ?? casada?.nome ?? '',
      conta_fixa_id: casada?.id ?? (semFixa ? NOVA_CONTA_FIXA : ''),
      competencia,
      valor: l.valor != null ? numero(l.valor) : casada ? numero(casada.valor_previsto) : '',
      vencimento: dataBr(l.vencimento ?? (casada ? `${competencia}-${String(casada.dia_vencimento).padStart(2, '0')}` : hojeIso())),
      consumo_valor: l.consumo_valor != null ? String(l.consumo_valor) : '',
      consumo_unidade: l.consumo_unidade ?? '',
      linha_digitavel: l.linha_digitavel ?? '',
      pix_copia_cola: l.pix_copia_cola ?? '',
      anexo_url: l.anexo_url ?? '',
    })
    if (semFixa) setNova({ nome: l.empresa ?? '', categoria_id: l.categoria_id && categoriasFixas.some((k) => k.id === l.categoria_id) ? l.categoria_id : sugerirCategoriaFixa(l.empresa ?? '') })
    setLido(true)
    aoLer?.(l)
  }

  async function aoEscolherArquivo(arquivo: File) {
    setLendo(true)
    setArquivoNome(arquivo.name)
    const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)
    let local: LeituraExtraida | null = null
    let texto = ''
    // 1) PDF com texto: lê aqui no aparelho, sem depender do servidor.
    if (ehPdf) {
      try {
        texto = await textoDoPdf(arquivo)
        if (texto.replace(/\s/g, '').length >= 30) local = lerFaturaDeTexto(texto, { competenciaPadrao, categorias, contasFixas: ativas })
      } catch (e) {
        console.warn('Leitura local do PDF falhou', e)
      }
      if (local) {
        aplicarLeitura(local)
        setLendo(false)
        if (local.confianca < 0.6) avisar('Li o PDF, mas com pouca certeza — confira os campos antes de salvar.', { tipo: 'info' })
      }
    }
    // 2) Servidor: guarda o anexo no Drive e, com chave do Claude, lê melhor (ou é a única leitura, no caso de fotos).
    setAnexando(true)
    try {
      const blob = arquivo.type.startsWith('image/') ? await comprimirImagem(arquivo) : arquivo
      const imagem_base64 = await arquivoParaBase64(blob)
      const servidor = await api<LeituraExtraida>('ler_imagem', { imagem_base64, mime: blob.type || arquivo.type || 'application/pdf', tipo: 'conta', nome_arquivo: arquivo.name, texto_extraido: texto || undefined })
      if (local) {
        const junta = mesclarLeituras(local, servidor)
        if (servidor.origem_leitura === 'claude') aplicarLeitura(junta)
        else if (servidor.anexo_url) m('anexo_url', servidor.anexo_url)
      } else {
        aplicarLeitura(servidor)
        if (servidor.confianca < 0.6) avisar(servidor.confianca === 0 ? 'Não consegui ler este arquivo. Preencha os campos à mão.' : 'Leitura com pouca certeza — confira os campos antes de salvar.', { tipo: 'info' })
      }
    } catch (e) {
      if (local) avisar('Fatura lida no aparelho. Só não consegui guardar o anexo no Drive: ' + (e instanceof Error ? e.message : ''), { tipo: 'info' })
      else avisar(explicarErroDeLeitura(e, ehPdf), { tipo: 'erro' })
    } finally {
      setAnexando(false)
      setLendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /** Cria a conta fixa escolhida em "Nova conta fixa…" e devolve o id. */
  async function criarContaFixa(valor: number, vencimento: string): Promise<string> {
    const nome = nova.nome.trim() || c.empresa.trim()
    if (!nome) throw new Error('Dê um nome à nova conta fixa (ex.: "Luz — Copel").')
    if (!nova.categoria_id) throw new Error('Escolha a categoria da nova conta fixa.')
    const criada = await api<ContaFixa>('salvar_conta_fixa', { conta_fixa: { nome, categoria_id: nova.categoria_id, valor_previsto: valor, dia_vencimento: Number(vencimento.slice(8, 10)) || 10, remetente_email: '', codigo_cliente: '', ativa: true } })
    aoCriarContaFixa?.(criada)
    return criada.id
  }

  async function salvar() {
    if (!c.conta_fixa_id && podeCriarContaFixa) { avisar('Escolha a conta fixa — ou "Nova conta fixa…" para cadastrar.', { tipo: 'erro' }); return }
    const valor = lerValor(c.valor)
    if (!valor) { avisar('Informe o valor da conta.', { tipo: 'erro' }); return }
    const vencimento = dataIso(c.vencimento)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) { avisar('Informe o vencimento como dd/mm/aaaa.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const conta_fixa_id = criandoFixa ? await criarContaFixa(valor, vencimento) : c.conta_fixa_id
      const consumo_valor = c.consumo_valor ? lerValor(c.consumo_valor) : undefined
      const conta: Partial<ContaAPagar> = {
        conta_fixa_id, competencia: c.competencia || competenciaDe(vencimento), valor, vencimento,
        linha_digitavel: c.linha_digitavel || undefined, pix_copia_cola: c.pix_copia_cola || undefined,
        consumo_valor, consumo_unidade: c.consumo_unidade || undefined,
        consumo: consumo_valor ? `${consumo_valor} ${c.consumo_unidade}`.trim() : undefined,
        anexo_url: c.anexo_url || undefined, status: 'aberta',
      }
      let salva = await api<ContaAPagar>('salvar_conta_a_pagar', { conta })
      if (pagarAgora) salva = await api<ContaAPagar>('marcar_conta_paga', { id: salva.id, forma_pgto: forma })
      avisar(pagarAgora ? 'Conta salva e lançada como paga' : criandoFixa ? 'Conta fixa criada e fatura salva. Já aparece no calendário.' : 'Conta a pagar salva. Já aparece no calendário.', { tipo: 'ok' })
      aoSalvar(salva, pagarAgora)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  const competencias = [somarMeses(competenciaPadrao, -2), somarMeses(competenciaPadrao, -1), competenciaPadrao, somarMeses(competenciaPadrao, 1)]
  if (c.competencia && !competencias.includes(c.competencia)) competencias.unshift(c.competencia)

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Enviar fatura" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolherArquivo(f) }} />
      <div className="field">
        {lido || lendo ? (
          <div className="flex items-center" style={{ gap: 10, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 9, padding: 6 }}>
            <span className="ico-sm" aria-hidden="true"><Icone nome="file-text" /></span>
            <div className="flex-1 min-w-0" style={{ fontSize: 12, color: 'var(--muted)' }} role="status" aria-live="polite">
              {lendo ? (
                <span className="flex items-center" style={{ gap: 8 }}><span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--sel)' }} />Lendo a fatura…</span>
              ) : <span className="truncate block">{arquivoNome || 'Fatura lida'} — {anexando ? 'confira os campos (guardando o anexo…)' : 'confira os campos.'}</span>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={lendo}><Icone nome="upload" />Outro arquivo</button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => inputRef.current?.click()} title="Lemos empresa, competência, valor, vencimento, código de barras, Pix e consumo.">
            <Icone nome="upload" />Enviar PDF ou foto da fatura
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor="ft-empresa">Empresa</label>
        <input id="ft-empresa" value={c.empresa} onChange={(e) => m('empresa', e.target.value)} placeholder="Ex.: Copel Distribuição" />
      </div>
      <div className="field">
        <label htmlFor="ft-cf">Conta fixa</label>
        <select id="ft-cf" value={c.conta_fixa_id} onChange={(e) => escolherContaFixa(e.target.value)}>
          <option value="">{podeCriarContaFixa ? 'Escolha a conta…' : ativas.length ? 'Escolha a conta (ou salve sem)…' : 'Sem conta fixa cadastrada — salvar avulsa'}</option>
          {ativas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          {podeCriarContaFixa && <option value={NOVA_CONTA_FIXA}>➕ Nova conta fixa…</option>}
        </select>
        {ativas.length === 0 && !podeCriarContaFixa && <small className="hint">Peça ao administrador para cadastrar as contas da casa em Configurações → Contas fixas. Enquanto isso a fatura é salva como "Conta".</small>}
      </div>
      {criandoFixa && (
        <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: 10, marginBottom: 12, display: 'grid', gap: 10 }} aria-label="Nova conta fixa">
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nova conta fixa: vai aparecer todo mês no calendário e nos previstos.</div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ft-nova-nome">Nome da conta</label>
            <input id="ft-nova-nome" value={nova.nome} onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))} placeholder='Ex.: "Luz — Copel"' />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ft-nova-cat">Categoria</label>
            <select id="ft-nova-cat" value={nova.categoria_id} onChange={(e) => setNova((n) => ({ ...n, categoria_id: e.target.value }))}>
              <option value="">Escolha a categoria…</option>
              {categoriasFixas.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2" style={{ gap: 12 }}>
        <div className="field">
          <label htmlFor="ft-comp">Competência</label>
          <select id="ft-comp" value={c.competencia} onChange={(e) => m('competencia', e.target.value)}>
            {competencias.map((k) => <option key={k} value={k}>{nomeCompetencia(k)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ft-valor">Valor</label>
          <input id="ft-valor" className="num" inputMode="decimal" value={c.valor} onChange={(e) => m('valor', e.target.value)} onBlur={() => c.valor && m('valor', numero(lerValor(c.valor)))} placeholder="0,00" />
        </div>
        <div className="field">
          <label htmlFor="ft-venc">Vencimento</label>
          <input id="ft-venc" className="num" inputMode="numeric" value={c.vencimento} onChange={(e) => m('vencimento', e.target.value)} placeholder="dd/mm/aaaa" />
        </div>
        <div className="field">
          <label htmlFor="ft-consumo">Consumo</label>
          <div className="flex" style={{ gap: 6 }}>
            <input id="ft-consumo" className="num" inputMode="decimal" value={c.consumo_valor} onChange={(e) => m('consumo_valor', e.target.value)} placeholder="320" style={{ minWidth: 0 }} />
            <select aria-label="Unidade" value={c.consumo_unidade} onChange={(e) => m('consumo_unidade', e.target.value)} style={{ width: 86, flex: 'none' }}>
              <option value="">—</option><option>kWh</option><option>m³</option><option>GB</option><option>min</option>
            </select>
          </div>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ft-linha">Linha digitável (código de barras)</label>
        <input id="ft-linha" className="num" inputMode="numeric" value={c.linha_digitavel} onChange={(e) => m('linha_digitavel', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ft-pix">Pix copia e cola</label>
        <textarea id="ft-pix" rows={2} value={c.pix_copia_cola} onChange={(e) => m('pix_copia_cola', e.target.value)} style={{ fontSize: 12 }} />
      </div>

      <label className="flex items-center" style={{ gap: 10, fontSize: 13, minHeight: 44, cursor: 'pointer' }}>
        <input type="checkbox" checked={pagarAgora} onChange={(e) => setPagarAgora(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--indigo)' }} />
        Também lançar como paga
      </label>
      {pagarAgora && (
        <div className="field">
          <label id="ft-forma">Como foi paga</label>
          <div className="seg" role="group" aria-labelledby="ft-forma" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {FORMAS.map((f) => <button key={f.id} type="button" aria-pressed={forma === f.id} onClick={() => setForma(f.id)}>{f.nome}</button>)}
          </div>
        </div>
      )}
      <div className="confirm">
        <p>{c.valor ? <>Conta de <b className="num">R$ {numero(lerValor(c.valor))}</b>{c.vencimento ? <> · vence <b className="num">{c.vencimento}</b></> : null}</> : 'Envie a fatura ou preencha os campos.'}</p>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || lendo}><Icone nome="check" />{salvando ? 'Salvando…' : 'Salvar conta a pagar'}</button>
      </div>
    </div>
  )
}
