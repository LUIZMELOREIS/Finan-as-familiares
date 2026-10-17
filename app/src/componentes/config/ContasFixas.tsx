import { useEffect, useState } from 'react'
import type { ContaFixa } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { moeda } from '../../util/formato'
import { Icone, corVar } from '../Icone'
import { Folha } from '../Folha'
import { Campo, Interruptor, useAcao } from './comuns'

function FolhaConta({ conta, aoFechar, aoSalvar }: { conta: ContaFixa; aoFechar: () => void; aoSalvar: (c: ContaFixa) => void }) {
  const boot = useBoot()
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<ContaFixa>({ ...conta })
  const fixas = boot.categorias.filter((c) => c.tipo_id === 't_fixas' && c.ativa)
  const grupos = boot.grupos.filter((g) => g.tipo_id === 't_fixas').sort((a, b) => a.ordem - b.ordem)
  const salvar = () => rodar(async () => {
    if (!f.nome.trim()) throw new Error('Informe o nome da conta.')
    if (!f.categoria_id) throw new Error('Escolha a categoria.')
    aoSalvar(await api<ContaFixa>('salvar_conta_fixa', { conta_fixa: f }))
    aoFechar()
  }, 'Conta salva.')
  return (
    <Folha aberta aoFechar={aoFechar} titulo={conta.id ? 'Editar conta fixa' : 'Nova conta fixa'}>
      <Campo rotulo="Nome (ex.: Luz — Copel)"><input className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus={!conta.id} /></Campo>
      <Campo rotulo="Categoria (despesas fixas)">
        <select className="campo" value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
          <option value="">Escolha…</option>
          {grupos.map((g) => <optgroup key={g.id} label={g.nome}>{fixas.filter((c) => c.grupo_id === g.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</optgroup>)}
        </select>
      </Campo>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Valor previsto (R$)"><input className="campo num" type="number" inputMode="decimal" min={0} step="0.01" value={f.valor_previsto} onChange={(e) => setF({ ...f, valor_previsto: Number(e.target.value) })} /></Campo>
        <Campo rotulo="Dia de vencimento"><input className="campo num" type="number" inputMode="numeric" min={1} max={31} value={f.dia_vencimento} onChange={(e) => setF({ ...f, dia_vencimento: Math.max(1, Math.min(31, Number(e.target.value))) })} /></Campo>
        <Campo rotulo="Remetente do e-mail" ajuda="Domínio ou endereço que manda a fatura (ex.: copel.com)."><input className="campo" value={f.remetente_email} onChange={(e) => setF({ ...f, remetente_email: e.target.value })} inputMode="email" /></Campo>
        <Campo rotulo="Código do cliente / UC" ajuda="Ajuda a casar o PDF com esta conta."><input className="campo num" value={f.codigo_cliente} onChange={(e) => setF({ ...f, codigo_cliente: e.target.value })} /></Campo>
      </div>
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Conta ativa</b><small>Inativas não geram previsão nem aviso de vencimento.</small></div><Interruptor ligado={f.ativa} aoMudar={(ativa) => setF({ ...f, ativa })} rotulo="Conta ativa" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
      </div>
    </Folha>
  )
}

export function ContasFixas() {
  const boot = useBoot()
  const atualizarContasFixas = useSessao((e) => e.atualizarContasFixas)
  const [lista, setLista] = useState<ContaFixa[]>(boot.contas_fixas)
  const [editando, setEditando] = useState<ContaFixa | null>(null)
  useEffect(() => { api<ContaFixa[]>('listar_contas_fixas').then((l) => { setLista(l); atualizarContasFixas(l) }).catch(() => {}) }, [atualizarContasFixas])
  const aoSalvar = (c: ContaFixa) => {
    const nova = lista.some((x) => x.id === c.id) ? lista.map((x) => (x.id === c.id ? c : x)) : [...lista, c]
    setLista(nova)
    atualizarContasFixas(nova)
  }
  const total = lista.filter((c) => c.ativa).reduce((s, c) => s + c.valor_previsto, 0)
  const ordenadas = [...lista].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.dia_vencimento - b.dia_vencimento)
  return (
    <div className="card">
      <h3>Contas da casa <span className="sub">{moeda(total)} previstos por mês</span></h3>
      <div className="rows">
        {ordenadas.map((c) => {
          const cat = boot.categorias.find((x) => x.id === c.categoria_id)
          const grupo = boot.grupos.find((g) => g.id === cat?.grupo_id)
          return (
            <button key={c.id} className="row" style={{ minHeight: 56 }} onClick={() => setEditando(c)}>
              <span className="ico-sm" style={{ color: corVar(grupo?.cor) }}><Icone nome={cat?.icone ?? 'receipt'} /></span>
              <span className="t"><b>{c.nome}</b><small>Vence dia {c.dia_vencimento} · {cat?.nome ?? 'sem categoria'}{c.remetente_email ? ` · ${c.remetente_email}` : ''}</small></span>
              {!c.ativa && <span className="tag proj">inativa</span>}
              <span className="amt num">{moeda(c.valor_previsto)}</span>
              <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
            </button>
          )
        })}
        {!lista.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma conta cadastrada ainda.</p>}
      </div>
      <button className="btn btn-primary mt-3" onClick={() => setEditando({ id: '', nome: '', categoria_id: '', valor_previsto: 0, dia_vencimento: 10, remetente_email: '', codigo_cliente: '', ativa: true })}><Icone nome="plus" />Nova conta fixa</button>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>As contas lidas do Gmail (marcador “Contas da Casa”) e da pasta _Entrada são casadas por remetente e código do cliente.</p>
      {editando && <FolhaConta conta={editando} aoFechar={() => setEditando(null)} aoSalvar={aoSalvar} />}
    </div>
  )
}
