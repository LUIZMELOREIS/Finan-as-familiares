import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { ContaFixa } from '../../tipos'
import { Folha } from '../Folha'
import { Campo, Interruptor } from './comuns'
import { lerValor, moeda, numero } from '../../util/formato'

const NOVA: ContaFixa = { id: '', nome: '', categoria_id: '', valor_previsto: 0, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true }

export function ContasFixas() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarContasFixas = useSessao((e) => e.atualizarContasFixas)
  const [edit, setEdit] = useState<ContaFixa | null>(null)
  const [valorTxt, setValorTxt] = useState('')
  const [salvando, setSalvando] = useState(false)
  const categorias = boot.categorias.filter((c) => c.tipo === 'despesa' && c.ativa !== false)

  // Atualiza a lista ao abrir (pode ter mudado em outro aparelho).
  useEffect(() => {
    api<ContaFixa[]>('listar_contas_fixas').then((l) => { if (Array.isArray(l)) atualizarContasFixas(l) }).catch(() => {})
  }, [atualizarContasFixas])

  function abrir(f: ContaFixa) {
    setEdit({ ...f })
    setValorTxt(f.valor_previsto ? numero(f.valor_previsto) : '')
  }

  async function salvar() {
    if (!edit) return
    if (!edit.nome.trim()) { avisar('Dê um nome à conta.', { tipo: 'erro' }); return }
    if (!edit.categoria_id) { avisar('Escolha a categoria.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const conta_fixa: ContaFixa = { ...edit, valor_previsto: lerValor(valorTxt), dia_vencimento: Math.min(31, Math.max(1, Number(edit.dia_vencimento) || 1)) }
      const salva = await api<ContaFixa>('salvar_conta_fixa', { conta_fixa })
      atualizarContasFixas(boot.contas_fixas.some((f) => f.id === salva.id) ? boot.contas_fixas.map((f) => (f.id === salva.id ? salva : f)) : [...boot.contas_fixas, salva])
      avisar('Conta fixa salva ✅', { tipo: 'ok' })
      setEdit(null)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  const total = boot.contas_fixas.filter((f) => f.ativa !== false).reduce((s, f) => s + f.valor_previsto, 0)

  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Contas que chegam todo mês. Com o remetente de e-mail cadastrado, a fatura entra sozinha no calendário.</p>
      <div className="card p-3 flex items-center justify-between"><span className="text-suave">Previsto por mês</span><span className="font-extrabold text-lg">{moeda(total)}</span></div>
      <ul className="space-y-2">
        {[...boot.contas_fixas].sort((a, b) => a.dia_vencimento - b.dia_vencimento).map((f) => {
          const cat = boot.categorias.find((c) => c.id === f.categoria_id)
          return (
            <li key={f.id}>
              <button className={`w-full card card-toque p-3 flex items-center gap-3 text-left ${f.ativa === false ? 'opacity-50' : ''}`} onClick={() => abrir(f)}>
                <span className="text-3xl w-10 text-center" aria-hidden>{cat?.icone ?? '🧾'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{f.nome}</span>
                  <span className="block text-sm text-suave truncate">Dia {f.dia_vencimento} · {cat?.nome ?? 'sem categoria'}{f.remetente_email ? ' · 📧' : ''}{f.ativa === false ? ' · inativa' : ''}</span>
                </span>
                <span className="font-bold tabular-nums">{moeda(f.valor_previsto)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button className="botao botao-primario w-full" onClick={() => abrir(NOVA)}>➕ Nova conta fixa</button>

      <Folha aberta={!!edit} aoFechar={() => setEdit(null)} titulo={edit?.id ? 'Editar conta fixa' : 'Nova conta fixa'}>
        {edit && (
          <div className="space-y-3">
            <Campo rotulo="Nome"><input className="campo" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex.: Copel (luz)" /></Campo>
            <Campo rotulo="Categoria">
              <select className="campo" value={edit.categoria_id} onChange={(e) => setEdit({ ...edit, categoria_id: e.target.value })}>
                <option value="">Escolha…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Valor previsto (R$)"><input className="campo" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="280,00" /></Campo>
              <Campo rotulo="Dia do vencimento"><input className="campo" type="number" min={1} max={31} inputMode="numeric" value={edit.dia_vencimento} onChange={(e) => setEdit({ ...edit, dia_vencimento: Number(e.target.value) })} /></Campo>
            </div>
            <Campo rotulo="Remetente do e-mail (opcional)" dica="Parte do endereço de quem manda a fatura, ex.: copel.com"><input className="campo" inputMode="email" value={edit.remetente_email} onChange={(e) => setEdit({ ...edit, remetente_email: e.target.value })} placeholder="copel.com" /></Campo>
            <Campo rotulo="Código do cliente / UC (opcional)" dica="Ajuda a reconhecer a fatura certa quando há mais de uma."><input className="campo" value={edit.codigo_cliente} onChange={(e) => setEdit({ ...edit, codigo_cliente: e.target.value })} /></Campo>
            <Interruptor ligado={edit.ativa !== false} aoMudar={(v) => setEdit({ ...edit, ativa: v })} rotulo="Ativa" descricao="Inativa não aparece nas previstas do mês." />
            <button className="botao botao-primario w-full" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar'}</button>
          </div>
        )}
      </Folha>
    </div>
  )
}
