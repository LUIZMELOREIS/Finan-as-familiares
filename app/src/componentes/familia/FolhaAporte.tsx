import { useState, type FormEvent } from 'react'
import { Folha } from '../Folha'
import { api } from '../../api/cliente'
import { useSessao } from '../../store/sessao'
import { lerValor, moeda } from '../../util/formato'
import type { Aporte, Projeto } from '../../tipos'

const SUGESTOES = [10, 20, 50, 100, 200, 500]

/** Folha "Fazer um aporte": valor grande + atalhos + observação → `aportar`. */
export function FolhaAporte({ aberta, aoFechar, projeto, aoAportado }: { aberta: boolean; aoFechar: () => void; projeto: Projeto | null; aoAportado: (a: Aporte) => void | Promise<void> }) {
  const avisar = useSessao((e) => e.avisar)
  const [texto, setTexto] = useState('')
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const valor = lerValor(texto)
  const falta = projeto ? Math.max(0, projeto.meta_valor - (projeto.valor_atual ?? 0)) : 0

  const fechar = () => {
    if (enviando) return
    setTexto('')
    setObs('')
    aoFechar()
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!projeto || valor <= 0) return
    setEnviando(true)
    try {
      const a = await api<Aporte>('aportar', { projeto_id: projeto.id, valor, observacao: obs.trim() })
      await aoAportado(a)
      setTexto('')
      setObs('')
      aoFechar()
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'Não foi possível guardar agora', { tipo: 'erro' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Folha aberta={aberta} aoFechar={fechar} titulo={projeto ? `💰 Guardar para ${projeto.nome}` : 'Fazer um aporte'}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block">
          <span className="rotulo">Quanto você vai guardar?</span>
          <div className="flex items-center gap-2 card px-4 py-2 bg-painel overflow-hidden">
            <span className="text-suave font-bold text-xl">R$</span>
            <input className="flex-1 min-w-0 w-full bg-transparent outline-none text-3xl font-extrabold min-h-14" inputMode="decimal" placeholder="0,00" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus aria-label="Valor do aporte em reais" />
          </div>
        </label>
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <button type="button" key={s} className="botao botao-secundario !px-3" onClick={() => setTexto(String(s))}>+ {moeda(s)}</button>
          ))}
          {falta > 0 && <button type="button" className="botao botao-amarelo !px-3" onClick={() => setTexto(falta.toFixed(2).replace('.', ','))}>🎯 O que falta ({moeda(falta)})</button>}
        </div>
        <label className="block">
          <span className="rotulo">Observação (opcional)</span>
          <input className="campo" placeholder="Ex.: Guardei da mesada" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={120} />
        </label>
        <button type="submit" className="botao botao-verde w-full text-lg !min-h-14" disabled={valor <= 0 || enviando}>
          {enviando ? '⏳ Guardando…' : `💰 Guardar ${valor > 0 ? moeda(valor) : ''}`}
        </button>
      </form>
    </Folha>
  )
}
