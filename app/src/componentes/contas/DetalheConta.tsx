import { useState } from 'react'
import { Folha } from '../Folha'
import { api } from '../../api/cliente'
import type { Categoria, ContaAPagar, ContaFixa, FormaPgto, Usuario } from '../../tipos'
import { dataBr, moeda, nomeCompetencia } from '../../util/formato'
import { copiarTexto } from '../config/comuns'
import { COR_SITUACAO, NOME_SITUACAO, situacaoDe } from './CalendarioVencimentos'
import { GraficoConsumo } from './GraficoConsumo'

const FORMAS: Array<{ id: FormaPgto; icone: string; nome: string }> = [
  { id: 'pix', icone: '⚡', nome: 'Pix' },
  { id: 'boleto', icone: '📄', nome: 'Boleto' },
  { id: 'débito', icone: '💳', nome: 'Débito' },
  { id: 'crédito', icone: '💳', nome: 'Crédito' },
  { id: 'dinheiro', icone: '💵', nome: 'Dinheiro' },
]

/** Folha de detalhe de uma conta: copiar código/Pix, marcar como paga, anexo e gráfico de consumo. */
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
  const [pagando, setPagando] = useState(false)
  if (!conta) return null
  const sit = situacaoDe(conta)
  const pagador = usuarios.find((u) => u.id === conta.pago_por)

  async function copiar(texto: string | undefined, rotulo: string) {
    if (!texto) return
    avisar((await copiarTexto(texto)) ? `${rotulo} copiado! Agora é só colar no app do banco. ✅` : 'Não foi possível copiar', { tipo: 'ok' })
  }

  async function pagar(forma: FormaPgto) {
    if (!conta) return
    setPagando(true)
    try {
      const r = await api<ContaAPagar>('marcar_conta_paga', { id: conta.id, forma_pgto: forma })
      aoAtualizar(r)
      avisar(`${contaFixa?.nome ?? 'Conta'} marcada como paga ✅`, { tipo: 'ok' })
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
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl" aria-hidden>{categoria?.icone ?? '🧾'}</span>
        <div className="flex-1">
          <div className="numero-grande">{moeda(conta.valor)}</div>
          <div className="text-sm text-suave">Vence {dataBr(conta.vencimento)} · {nomeCompetencia(conta.competencia)}</div>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ background: COR_SITUACAO[sit] }}>{NOME_SITUACAO[sit]}</span>
      </div>
      {conta.consumo && <p className="text-sm mb-2">📏 Consumo: <strong>{conta.consumo}</strong></p>}
      {conta.status === 'paga' && (
        <p className="text-sm text-verde mb-3">✅ Paga em {dataBr(conta.pago_em)}{pagador ? ` por ${pagador.avatar} ${pagador.apelido}` : ''}</p>
      )}

      <div className="grid grid-cols-1 gap-2 mb-4">
        {conta.linha_digitavel && (
          <button className="botao botao-secundario !min-h-14 justify-start overflow-hidden" onClick={() => copiar(conta.linha_digitavel, 'Código de barras')}>
            <span className="text-2xl shrink-0" aria-hidden>📋</span>
            <span className="text-left flex-1 min-w-0">
              <span className="block">Copiar código de barras</span>
              <span className="block text-xs text-suave font-normal font-mono truncate">{conta.linha_digitavel}</span>
            </span>
          </button>
        )}
        {conta.pix_copia_cola && (
          <button className="botao botao-secundario !min-h-14 justify-start overflow-hidden" onClick={() => copiar(conta.pix_copia_cola, 'Pix copia-e-cola')}>
            <span className="text-2xl shrink-0" aria-hidden>📋</span>
            <span className="text-left min-w-0"><span className="block">Copiar Pix copia-e-cola</span><span className="block text-xs text-suave font-normal">Cole na opção "Pix copia e cola" do banco</span></span>
          </button>
        )}
        {conta.anexo_url && (
          <a className="botao botao-secundario !min-h-14 justify-start" href={conta.anexo_url} target="_blank" rel="noopener noreferrer">
            <span className="text-2xl" aria-hidden>📎</span> Ver a fatura (anexo)
          </a>
        )}
        {conta.status === 'aberta' && !escolhendoForma && (
          <button className="botao botao-verde !min-h-14" onClick={() => setEscolhendoForma(true)}>✅ Marcar como paga</button>
        )}
        {conta.status === 'aberta' && escolhendoForma && (
          <div className="card p-3">
            <div className="font-semibold mb-2">Como você pagou?</div>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button key={f.id} className="botao botao-secundario" disabled={pagando} onClick={() => pagar(f.id)}><span aria-hidden>{f.icone}</span> {f.nome}</button>
              ))}
            </div>
            <button className="botao botao-fantasma w-full mt-2" onClick={() => setEscolhendoForma(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {contaFixa && (
        <div className="card p-3">
          <GraficoConsumo contaFixaId={contaFixa.id} />
        </div>
      )}
    </Folha>
  )
}
