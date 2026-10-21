import { CategoryIcon } from './CategoryIcon'
import { dataCurta, formatarMoeda } from '../utils/format'
import type { Transacao } from '../data/mock'

interface Props { transacoes: Transacao[]; titulo?: string; aoVerTudo?: () => void; mostrarData?: boolean }

/** ==== LISTA "QUEM GASTOU": ícone, loja, valor e etiqueta do membro ==== */
export function TransactionList({ transacoes, titulo, aoVerTudo, mostrarData = false }: Props) {
  return (
    <section className="card" aria-label={titulo ?? 'Lançamentos'}>
      {titulo && (
        <div className="secao-titulo">
          <h2>{titulo}</h2>
          {aoVerTudo && <button type="button" onClick={aoVerTudo}>Ver tudo</button>}
        </div>
      )}
      <ul className="lista" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {transacoes.map((t) => (
          <li key={t.id} className="linha">
            <span className="icone"><CategoryIcon categoria={t.categoria} /></span>
            <div className="texto">
              <p className="loja">{t.loja}</p>
              <p className="meta">
                {mostrarData && <span>{dataCurta(t.data)}</span>}
                <span className="tag">por {t.membro}</span>
              </p>
            </div>
            <span className={`valor num ${t.valor > 0 ? 'positivo' : ''}`}>{t.valor > 0 ? '+' : '−'} {formatarMoeda(Math.abs(t.valor))}</span>
          </li>
        ))}
      </ul>
    </section>
  )
  /* ==== FIM DA LISTA ==== */
}
