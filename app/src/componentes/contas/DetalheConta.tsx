/**
 * Folha de detalhe de uma conta: copiar código de barras / Pix, marcar como
 * paga (escolhendo a forma e registrando quem pagou), anexo e gráfico de consumo.
 */
import { useState } from 'react'
import { api } from '../../api/cliente'
import type { Categoria, ContaAPagar, ContaFixa, FormaPgto, Usuario } from '../../tipos'
import { dataBr, moeda, nomeCompetencia } from '../../util/formato'
import { Avatar } from '../Avatar'
import { Folha } from '../Folha'
import { Icone } from '../Icone'
import { copiarTexto, estiloCor } from '../lancar/comuns'
import { GraficoConsumo } from './GraficoConsumo'
import { NOME_SITUACAO, TAG_SITUACAO, situacaoDe } from './Calendario'

const FORMAS: Array<{ id: FormaPgto; nome: string }> = [
  { id: 'pix', nome: 'Pix' }, { id: 'boleto', nome: 'Boleto' }, { id: 'débito', nome: 'Débito' }, { id: 'crédito', nome: 'Crédito' }, { id: 'dinheiro', nome: 'Dinheiro' },
]

export function DetalheConta({ conta, contaFixa, categoria, usuarios, aoFechar, aoAtualizar, avisar }: {
  conta: ContaAPagar | null
  contaFixa?: ContaFixa
  categoria?: Categoria
  usuarios: Usuario[]
  aoFechar: () => void
  aoAtualizar: (c: ContaAPagar) => void
  avisar: (texto: string, opcoes?: { tipo?: 'ok' | 'erro' | 'info' }) => void
}) {
  const [escolhendoForma, setEscolhendoForma] = useState(false)
  const [forma, setForma] = useState<FormaPgto>('pix')
  const [pagando, setPagando] = useState(false)
  if (!conta) return null
  const sit = situacaoDe(conta)
  const pagador = usuarios.find((u) => u.id === conta.pago_por)

  async function copiar(texto: string | undefined, rotulo: string) {
    if (!texto) return
    avisar((await copiarTexto(texto)) ? `${rotulo} copiado. Cole no app do banco.` : 'Não foi possível copiar', { tipo: 'ok' })
  }

  async function pagar() {
    if (!conta) return
    setPagando(true)
    try {
      const r = await api<ContaAPagar>('marcar_conta_paga', { id: conta.id, forma_pgto: forma })
      aoAtualizar(r)
      avisar(`${contaFixa?.nome ?? 'Conta'} marcada como paga`, { tipo: 'ok' })
      setEscolhendoForma(false)
      aoFechar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível marcar como paga', { tipo: 'erro' })
    } finally {
      setPagando(false)
    }
  }

  return (
    <Folha aberta={!!conta} aoFechar={aoFechar} titulo={contaFixa?.nome ?? 'Conta'}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
        <span className="ico" style={estiloCor(categoria?.cor)} aria-hidden="true"><Icone nome={categoria?.icone ?? 'receipt'} /></span>
        <div className="flex-1 min-w-0">
          <div className="num" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{moeda(conta.valor)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Vence <span className="num">{dataBr(conta.vencimento)}</span> · {nomeCompetencia(conta.competencia)}{conta.consumo ? ` · ${conta.consumo}` : ''}</div>
        </div>
        <span className={`tag ${TAG_SITUACAO[sit]}`}>{NOME_SITUACAO[sit]}</span>
      </div>

      {conta.status === 'paga' && (
        <p className="flex items-center" style={{ gap: 8, fontSize: 13, color: '#7FD992', margin: '0 0 12px' }}>
          <Icone nome="circle-check" />Paga em <span className="num">{dataBr(conta.pago_em)}</span>{pagador && <> por <Avatar usuario={pagador} tamanho={20} /> {pagador.apelido}</>}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {conta.linha_digitavel && (
          <button type="button" className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => copiar(conta.linha_digitavel, 'Código de barras')}>
            <Icone nome="copy" />
            <span className="min-w-0"><span style={{ display: 'block' }}>Copiar código de barras</span><span className="num" style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conta.linha_digitavel}</span></span>
          </button>
        )}
        {conta.pix_copia_cola && (
          <button type="button" className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => copiar(conta.pix_copia_cola, 'Pix copia e cola')}>
            <Icone nome="qr-code" />
            <span className="min-w-0"><span style={{ display: 'block' }}>Copiar Pix</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>Cole em “Pix copia e cola” no app do banco</span></span>
          </button>
        )}
        {conta.anexo_url && (
          <a className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} href={conta.anexo_url} target="_blank" rel="noopener noreferrer"><Icone nome="paperclip" />Ver a fatura (anexo)</a>
        )}
        {conta.status === 'aberta' && !escolhendoForma && (
          <button type="button" className="btn btn-primary" onClick={() => setEscolhendoForma(true)}><Icone nome="check" />Marcar como paga</button>
        )}
        {conta.status === 'aberta' && escolhendoForma && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label id="pg-forma">Como foi paga?</label>
            <div className="seg" role="group" aria-labelledby="pg-forma" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {FORMAS.map((f) => <button key={f.id} type="button" aria-pressed={forma === f.id} onClick={() => setForma(f.id)}>{f.nome}</button>)}
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEscolhendoForma(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={pagar} disabled={pagando}><Icone nome="check" />{pagando ? 'Registrando…' : 'Confirmar pagamento'}</button>
            </div>
          </div>
        )}
      </div>

      {contaFixa && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <GraficoConsumo contaFixaId={contaFixa.id} cor={categoria?.cor} />
        </div>
      )}
    </Folha>
  )
}
