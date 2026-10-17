/**
 * Card da esquerda da tela Lançar ("Dados lidos do cupom" / "Dados da despesa"):
 * valor, estabelecimento, data, forma de pagamento, cartão, parcelas e quem gastou.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Cartao, FormaPgto, Usuario } from '../../tipos'
import { dataBr, dataIso, moeda } from '../../util/formato'
import { Icone } from '../Icone'
import { CampoValor } from './CampoValor'
import { nomeCartao } from './comuns'
import type { Rascunho } from './rascunho'

const FORMAS: Array<{ id: FormaPgto; nome: string }> = [
  { id: 'pix', nome: 'Pix' }, { id: 'débito', nome: 'Débito' }, { id: 'crédito', nome: 'Crédito' }, { id: 'dinheiro', nome: 'Dinheiro' },
]

export function DadosDespesa({ titulo, lido, topo, rascunho, aoMudar, cartoes, usuarios, usuarioAtual, valorGastoGrande, editando, ehReceita, autoFocoValor }: {
  titulo: string
  lido?: boolean
  topo?: ReactNode
  rascunho: Rascunho
  aoMudar: (p: Partial<Rascunho>) => void
  cartoes: Cartao[]
  usuarios: Usuario[]
  usuarioAtual: Usuario
  valorGastoGrande: number
  editando?: boolean
  ehReceita?: boolean
  autoFocoValor?: boolean
}) {
  const r = rascunho
  const [dataTexto, setDataTexto] = useState(dataBr(r.data))
  useEffect(() => { setDataTexto(dataBr(r.data)) }, [r.data])

  const cartoesAtivos = cartoes.filter((k) => k.ativo !== false)
  const ehDependente = usuarioAtual.perfil === 'Dependente'
  const formas = r.forma_pgto === 'boleto' ? [...FORMAS, { id: 'boleto' as FormaPgto, nome: 'Boleto' }] : FORMAS
  const gastoGrande = !ehReceita && valorGastoGrande > 0 && r.valor >= valorGastoGrande

  function mudarForma(f: FormaPgto) {
    const p: Partial<Rascunho> = { forma_pgto: f }
    if (f === 'crédito' && !r.cartao_id) p.cartao_id = (cartoesAtivos.find((k) => k.titular_id === r.usuario_id) ?? cartoesAtivos[0])?.id
    if (f !== 'crédito') p.parcelas = 1
    aoMudar(p)
  }

  function mudarData(texto: string) {
    setDataTexto(texto)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      const iso = dataIso(texto)
      if (!isNaN(new Date(iso).getTime())) aoMudar({ data: iso })
    }
  }

  return (
    <div className="card">
      <h3>{titulo} {lido && <span className="tag ok">conferir</span>}</h3>
      {topo}
      <div className="field">
        <label htmlFor="valor">Valor</label>
        <CampoValor id="valor" valor={r.valor} aoMudar={(v) => aoMudar({ valor: v })} autoFoco={autoFocoValor} />
        {gastoGrande && (
          <Link to="/conselho" className="tag warn" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '4px 9px' }}>
            <Icone nome="scale" tamanho={13} />Gasto grande — leve ao Conselho
          </Link>
        )}
      </div>
      <div className="field">
        <label htmlFor="estab">{ehReceita ? 'Origem' : 'Estabelecimento'}</label>
        <input id="estab" value={r.estabelecimento} onChange={(e) => aoMudar({ estabelecimento: e.target.value, descricao: e.target.value })} placeholder={ehReceita ? 'Ex.: Empresa, cliente…' : 'Ex.: Supermercado Condor'} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="data">Data</label>
        <input id="data" className="num" value={dataTexto} inputMode="numeric" placeholder="dd/mm/aaaa" onChange={(e) => mudarData(e.target.value)} onBlur={() => setDataTexto(dataBr(r.data))} />
      </div>
      <div className="field">
        <label id="rot-forma">Forma de pagamento</label>
        <div className="seg" role="group" aria-labelledby="rot-forma" style={formas.length > 4 ? { gridTemplateColumns: `repeat(${formas.length}, 1fr)` } : undefined}>
          {formas.map((f) => <button key={f.id} type="button" aria-pressed={r.forma_pgto === f.id} onClick={() => mudarForma(f.id)}>{f.nome}</button>)}
        </div>
      </div>
      {r.forma_pgto === 'crédito' && cartoesAtivos.length > 0 && (
        <div className="field">
          <label htmlFor="cartao">Cartão</label>
          <select id="cartao" value={r.cartao_id ?? ''} onChange={(e) => aoMudar({ cartao_id: e.target.value || undefined })}>
            {cartoesAtivos.map((k) => <option key={k.id} value={k.id}>{nomeCartao(k, usuarios)}</option>)}
          </select>
        </div>
      )}
      {r.forma_pgto === 'crédito' && !editando && (
        <div className="field">
          <label htmlFor="parcelas">Parcelas</label>
          <select id="parcelas" className="num" value={r.parcelas} onChange={(e) => aoMudar({ parcelas: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n === 1 ? '1x (à vista)' : `${n}x de ${moeda(r.valor / n)}`}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="quem">{ehReceita ? 'Quem recebeu' : 'Quem gastou'}</label>
        <select id="quem" value={r.usuario_id} disabled={ehDependente} onChange={(e) => aoMudar({ usuario_id: e.target.value })}>
          {(ehDependente ? [usuarioAtual] : usuarios.filter((u) => u.ativo)).map((u) => <option key={u.id} value={u.id}>{u.apelido}</option>)}
        </select>
      </div>
    </div>
  )
}
