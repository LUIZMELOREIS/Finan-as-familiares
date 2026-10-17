import { useRef, useState } from 'react'
import { Folha } from '../Folha'
import { Carregando } from '../Carregando'
import { api, arquivoParaBase64, comprimirImagem } from '../../api/cliente'
import type { ContaAPagar, ContaFixa, LeituraExtraida } from '../../tipos'
import { competenciaDe, hojeIso, lerValor, normalizar, numero } from '../../util/formato'
import { Campo } from '../config/comuns'

interface Rascunho {
  empresa: string
  conta_fixa_id: string
  competencia: string
  valor: string
  vencimento: string
  consumo_valor: string
  consumo_unidade: string
  linha_digitavel: string
  pix_copia_cola: string
  anexo_url: string
}

/** Botão "Enviar fatura (foto ou PDF)" + folha de confirmação do que foi lido. */
export function EnviarFatura({ contasFixas, competenciaPadrao, avisar, aoSalvar, classe }: {
  contasFixas: ContaFixa[]
  competenciaPadrao: string
  avisar: (texto: string, opcoes?: { tipo?: 'ok' | 'erro' | 'info' }) => void
  aoSalvar: (c: ContaAPagar) => void
  classe?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [r, setR] = useState<Rascunho | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function aoEscolher(arquivo: File) {
    setLendo(true)
    try {
      const blob = arquivo.type.startsWith('image/') ? await comprimirImagem(arquivo) : arquivo
      const imagem_base64 = await arquivoParaBase64(blob)
      const l = await api<LeituraExtraida>('ler_imagem', { imagem_base64, mime: blob.type || arquivo.type || 'application/pdf', tipo: 'conta', nome_arquivo: arquivo.name })
      // Casa a conta fixa: pelo id devolvido, pela empresa ou pelo remetente.
      const emp = normalizar(l.empresa ?? '')
      const casada = contasFixas.find((f) => f.id === l.conta_fixa_id)
        ?? contasFixas.find((f) => emp && (normalizar(f.nome).split(' ')[0] === emp.split(' ')[0] || (f.remetente_email && emp.includes(normalizar(f.remetente_email).split(' ')[0]))))
      setR({
        empresa: l.empresa ?? '',
        conta_fixa_id: casada?.id ?? '',
        competencia: l.competencia ?? competenciaPadrao,
        valor: l.valor != null ? numero(l.valor) : casada ? numero(casada.valor_previsto) : '',
        vencimento: l.vencimento ?? (casada ? `${competenciaPadrao}-${String(casada.dia_vencimento).padStart(2, '0')}` : hojeIso()),
        consumo_valor: l.consumo_valor != null ? String(l.consumo_valor) : '',
        consumo_unidade: l.consumo_unidade ?? '',
        linha_digitavel: l.linha_digitavel ?? '',
        pix_copia_cola: l.pix_copia_cola ?? '',
        anexo_url: l.anexo_url ?? '',
      })
      if (l.confianca < 0.6) avisar('Leitura com pouca certeza — confira os campos antes de salvar.', { tipo: 'info' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível ler a fatura', { tipo: 'erro' })
    } finally {
      setLendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function salvar() {
    if (!r) return
    if (!r.conta_fixa_id) { avisar('Escolha a qual conta fixa essa fatura pertence.', { tipo: 'erro' }); return }
    const valor = lerValor(r.valor)
    if (!valor) { avisar('Informe o valor da conta.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const consumo_valor = r.consumo_valor ? lerValor(r.consumo_valor) : undefined
      const conta: Partial<ContaAPagar> = {
        conta_fixa_id: r.conta_fixa_id,
        competencia: r.competencia || competenciaDe(r.vencimento),
        valor,
        vencimento: r.vencimento,
        linha_digitavel: r.linha_digitavel || undefined,
        pix_copia_cola: r.pix_copia_cola || undefined,
        consumo_valor,
        consumo_unidade: r.consumo_unidade || undefined,
        consumo: consumo_valor ? `${consumo_valor} ${r.consumo_unidade}`.trim() : undefined,
        anexo_url: r.anexo_url || undefined,
        status: 'aberta',
      }
      const salva = await api<ContaAPagar>('salvar_conta_a_pagar', { conta })
      aoSalvar(salva)
      avisar('Fatura salva! Já aparece no calendário. ✅', { tipo: 'ok' })
      setR(null)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar', { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  const m = <K extends keyof Rascunho>(k: K, v: string) => setR((a) => (a ? { ...a, [k]: v } : a))

  return (
    <>
      {lendo ? (
        <div className={classe}><Carregando texto="Lendo a fatura… (valor, vencimento, código de barras)" /></div>
      ) : (
        <label className={`botao botao-primario cursor-pointer ${classe ?? ''}`}>
          📎 Enviar fatura (foto ou PDF)
          <input ref={inputRef} type="file" className="sr-only" accept="image/*,application/pdf" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolher(f) }} />
        </label>
      )}

      <Folha aberta={!!r} aoFechar={() => setR(null)} titulo="Confira o que lemos">
        {r && (
          <div className="space-y-3">
            <Campo rotulo="Empresa">
              <input className="campo" value={r.empresa} onChange={(e) => m('empresa', e.target.value)} />
            </Campo>
            <Campo rotulo="É a conta fixa…">
              <select className="campo" value={r.conta_fixa_id} onChange={(e) => m('conta_fixa_id', e.target.value)}>
                <option value="">Escolha…</option>
                {contasFixas.filter((f) => f.ativa !== false).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Competência (mês)">
                <input className="campo" type="month" value={r.competencia} onChange={(e) => m('competencia', e.target.value)} />
              </Campo>
              <Campo rotulo="Valor (R$)">
                <input className="campo text-lg font-bold" inputMode="decimal" value={r.valor} onChange={(e) => m('valor', e.target.value)} />
              </Campo>
              <Campo rotulo="Vencimento">
                <input className="campo" type="date" value={r.vencimento} onChange={(e) => m('vencimento', e.target.value)} />
              </Campo>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Campo rotulo="Consumo">
                  <input className="campo" inputMode="decimal" value={r.consumo_valor} onChange={(e) => m('consumo_valor', e.target.value)} placeholder="320" />
                </Campo>
                <Campo rotulo="Unid.">
                  <select className="campo !w-24" value={r.consumo_unidade} onChange={(e) => m('consumo_unidade', e.target.value)}>
                    <option value="">—</option><option>kWh</option><option>m³</option><option>GB</option><option>min</option>
                  </select>
                </Campo>
              </div>
            </div>
            <Campo rotulo="Linha digitável (código de barras)">
              <input className="campo font-mono text-sm" value={r.linha_digitavel} onChange={(e) => m('linha_digitavel', e.target.value)} />
            </Campo>
            <Campo rotulo="Pix copia-e-cola">
              <textarea className="campo font-mono text-xs" rows={2} value={r.pix_copia_cola} onChange={(e) => m('pix_copia_cola', e.target.value)} />
            </Campo>
            <button className="botao botao-primario w-full !min-h-14" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar conta'}</button>
          </div>
        )}
      </Folha>
    </>
  )
}
