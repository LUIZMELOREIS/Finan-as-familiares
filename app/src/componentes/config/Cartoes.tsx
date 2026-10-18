import { useState } from 'react'
import type { Cartao } from '../../tipos'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import { Icone, corVar } from '../Icone'
import { Avatar } from '../Avatar'
import { Folha } from '../Folha'
import { Campo, Interruptor, SeletorCor, useAcao } from './comuns'

export const BANCOS = ['Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Nubank', 'Inter', 'C6', 'BV', 'Ailos/Sicredi/Sicoob', 'Outro']

function FolhaCartao({ cartao, aoFechar }: { cartao: Cartao; aoFechar: () => void }) {
  const boot = useBoot()
  const atualizarCartoes = useSessao((e) => e.atualizarCartoes)
  const { rodar, ocupado } = useAcao()
  const [f, setF] = useState<Cartao>({ ...cartao })
  const salvar = () => rodar(async () => {
    if (!f.apelido.trim()) throw new Error('Dê um apelido ao cartão.')
    if (!/^\d{4}$/.test(f.final)) throw new Error('Informe só os 4 últimos dígitos.')
    if (!f.titular_id) throw new Error('Escolha o titular.')
    const salvo = await api<Cartao>('salvar_cartao', { cartao: f })
    atualizarCartoes(boot.cartoes.some((k) => k.id === salvo.id) ? boot.cartoes.map((k) => (k.id === salvo.id ? salvo : k)) : [...boot.cartoes, salvo])
    aoFechar()
  }, 'Cartão salvo.')
  return (
    <Folha aberta aoFechar={aoFechar} titulo={cartao.id ? 'Editar cartão' : 'Novo cartão'}>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Apelido"><input className="campo" value={f.apelido} onChange={(e) => setF({ ...f, apelido: e.target.value })} placeholder="Itaú do Luiz" autoFocus={!cartao.id} /></Campo>
        <Campo rotulo="Banco">
          <select className="campo" value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })}>{BANCOS.map((b) => <option key={b}>{b}</option>)}</select>
        </Campo>
        <Campo rotulo="Final do cartão (4 dígitos)" ajuda="Nunca pedimos o número completo. O final identifica o membro nos SMS do banco.">
          <input className="campo num" inputMode="numeric" maxLength={4} value={f.final} onChange={(e) => setF({ ...f, final: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4321" style={{ letterSpacing: 4 }} />
        </Campo>
        <Campo rotulo="Titular">
          <select className="campo" value={f.titular_id} onChange={(e) => setF({ ...f, titular_id: e.target.value })}>
            <option value="">Escolha…</option>
            {boot.usuarios.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.apelido}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Dia do fechamento"><input className="campo num" type="number" inputMode="numeric" min={1} max={31} value={f.dia_fechamento} onChange={(e) => setF({ ...f, dia_fechamento: Math.max(1, Math.min(31, Number(e.target.value))) })} /></Campo>
        <Campo rotulo="Dia do vencimento"><input className="campo num" type="number" inputMode="numeric" min={1} max={31} value={f.dia_vencimento} onChange={(e) => setF({ ...f, dia_vencimento: Math.max(1, Math.min(31, Number(e.target.value))) })} /></Campo>
      </div>
      <Campo rotulo="Cor"><SeletorCor valor={f.cor} aoMudar={(cor) => setF({ ...f, cor })} /></Campo>
      <div className="rows mb-3">
        <div className="row" style={{ minHeight: 52 }}><div className="t"><b>Cartão ativo</b><small>Inativos não recebem compras da captura automática.</small></div><Interruptor ligado={f.ativo} aoMudar={(ativo) => setF({ ...f, ativo })} rotulo="Cartão ativo" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={ocupado} onClick={salvar}><Icone nome="check" />Salvar</button>
      </div>
    </Folha>
  )
}

export function Cartoes() {
  const boot = useBoot()
  const [editando, setEditando] = useState<Cartao | null>(null)
  return (
    <div className="card">
      <h3>Cartões da família <span className="sub">só os 4 últimos dígitos</span></h3>
      <div className="rows">
        {boot.cartoes.map((k) => {
          const titular = boot.usuarios.find((u) => u.id === k.titular_id)
          return (
            <button key={k.id} className="row" style={{ minHeight: 56 }} onClick={() => setEditando(k)}>
              <span className="ico-sm" style={{ color: corVar(k.cor) }}><Icone nome="credit-card" /></span>
              <span className="t"><b>{k.apelido} <span className="num" style={{ color: 'var(--muted)', fontWeight: 400 }}>•••• {k.final}</span></b><small>{k.banco} · fecha dia {k.dia_fechamento} · vence dia {k.dia_vencimento}</small></span>
              {!k.ativo && <span className="tag proj">inativo</span>}
              <Avatar usuario={titular} tamanho={28} />
              <Icone nome="chevron-right" style={{ color: 'var(--faint)' }} />
            </button>
          )
        })}
        {!boot.cartoes.length && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum cartão cadastrado.</p>}
      </div>
      <button className="btn btn-primary mt-3" onClick={() => setEditando({ id: '', apelido: '', banco: 'Itaú', final: '', titular_id: boot.usuario.id, dia_fechamento: 28, dia_vencimento: 5, cor: 'indigo', ativo: true })}><Icone nome="plus" />Novo cartão</button>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 0 0' }}>O fechamento define em que competência cada compra parcelada cai. Nunca guardamos número completo, CVV ou senha.</p>
      {editando && <FolhaCartao cartao={editando} aoFechar={() => setEditando(null)} />}
    </div>
  )
}
