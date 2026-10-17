import { useState } from 'react'
import { api } from '../../api/cliente'
import { useBoot, useSessao } from '../../store/sessao'
import type { Cartao } from '../../tipos'
import { Folha } from '../Folha'
import { Campo, Interruptor, SeletorCor } from './comuns'

export const BANCOS = ['Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Nubank', 'Inter', 'C6', 'BV', 'Ailos/Sicredi/Sicoob', 'Outro']

export function Cartoes() {
  const boot = useBoot()
  const avisar = useSessao((e) => e.avisar)
  const atualizarCartoes = useSessao((e) => e.atualizarCartoes)
  const [edit, setEdit] = useState<Cartao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const novo = (): Cartao => ({ id: '', apelido: '', banco: 'Itaú', final: '', titular_id: boot.usuario.id, dia_fechamento: 25, dia_vencimento: 5, cor: '#5B5BE0', ativo: true })

  async function salvar() {
    if (!edit) return
    if (!edit.apelido.trim()) { avisar('Dê um apelido ao cartão (ex.: "Itaú do Pai").', { tipo: 'erro' }); return }
    if (!/^\d{4}$/.test(edit.final)) { avisar('Informe só os 4 últimos dígitos.', { tipo: 'erro' }); return }
    setSalvando(true)
    try {
      const salvo = await api<Cartao>('salvar_cartao', { cartao: edit })
      atualizarCartoes(boot.cartoes.some((k) => k.id === salvo.id) ? boot.cartoes.map((k) => (k.id === salvo.id ? salvo : k)) : [...boot.cartoes, salvo])
      avisar('Cartão salvo ✅', { tipo: 'ok' })
      setEdit(null)
    } catch (e) { avisar(e instanceof Error ? e.message : 'Erro ao salvar', { tipo: 'erro' }) }
    finally { setSalvando(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-suave">Cadastre os cartões para o app reconhecer os SMS de compra e saber de quem é cada gasto.</p>
      <div className="card p-3 text-sm flex gap-2 items-start" style={{ borderColor: 'var(--verde)' }}>
        <span className="text-xl" aria-hidden>🔒</span>
        <span><strong>Nunca pedimos o número completo</strong> do cartão, validade ou código de segurança. Só os 4 últimos dígitos, que aparecem no SMS do banco.</span>
      </div>
      <ul className="space-y-2">
        {boot.cartoes.map((k) => {
          const titular = boot.usuarios.find((u) => u.id === k.titular_id)
          return (
            <li key={k.id}>
              <button className={`w-full card card-toque p-3 flex items-center gap-3 text-left ${k.ativo === false ? 'opacity-50' : ''}`} onClick={() => setEdit({ ...k })}>
                <span className="w-14 h-9 rounded-md flex items-end justify-end p-1 text-[10px] text-white font-mono shrink-0" style={{ background: k.cor }} aria-hidden>{k.final}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{k.apelido}</span>
                  <span className="block text-sm text-suave truncate">{k.banco} · final {k.final} · {titular?.avatar} {titular?.apelido ?? '—'}{k.ativo === false ? ' · inativo' : ''}</span>
                  <span className="block text-xs text-suave">Fecha dia {k.dia_fechamento} · vence dia {k.dia_vencimento}</span>
                </span>
                <span className="text-suave text-2xl" aria-hidden>›</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button className="botao botao-primario w-full" onClick={() => setEdit(novo())}>➕ Novo cartão</button>

      <Folha aberta={!!edit} aoFechar={() => setEdit(null)} titulo={edit?.id ? 'Editar cartão' : 'Novo cartão'}>
        {edit && (
          <div className="space-y-3">
            <Campo rotulo="Apelido"><input className="campo" value={edit.apelido} onChange={(e) => setEdit({ ...edit, apelido: e.target.value })} placeholder="Ex.: Nubank da Mãe" /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Banco">
                <select className="campo" value={edit.banco} onChange={(e) => setEdit({ ...edit, banco: e.target.value })}>
                  {BANCOS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Final (4 dígitos)" dica="Nunca o número completo.">
                <input className="campo text-center tracking-[0.3em] text-lg font-mono" inputMode="numeric" maxLength={4} value={edit.final} onChange={(e) => setEdit({ ...edit, final: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" />
              </Campo>
            </div>
            <Campo rotulo="Titular">
              <select className="campo" value={edit.titular_id} onChange={(e) => setEdit({ ...edit, titular_id: e.target.value })}>
                {boot.usuarios.filter((u) => u.ativo !== false).map((u) => <option key={u.id} value={u.id}>{u.avatar} {u.apelido}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Dia de fechamento"><input className="campo" type="number" min={1} max={31} inputMode="numeric" value={edit.dia_fechamento} onChange={(e) => setEdit({ ...edit, dia_fechamento: Number(e.target.value) })} /></Campo>
              <Campo rotulo="Dia de vencimento"><input className="campo" type="number" min={1} max={31} inputMode="numeric" value={edit.dia_vencimento} onChange={(e) => setEdit({ ...edit, dia_vencimento: Number(e.target.value) })} /></Campo>
            </div>
            <SeletorCor valor={edit.cor} aoMudar={(cor) => setEdit({ ...edit, cor })} />
            <Interruptor ligado={edit.ativo !== false} aoMudar={(v) => setEdit({ ...edit, ativo: v })} rotulo="Cartão ativo" />
            <button className="botao botao-primario w-full" onClick={salvar} disabled={salvando}>{salvando ? '⏳ Salvando…' : '💾 Salvar cartão'}</button>
          </div>
        )}
      </Folha>
    </div>
  )
}
