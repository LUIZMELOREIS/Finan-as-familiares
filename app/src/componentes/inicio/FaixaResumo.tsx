import { moeda } from '../../util/formato'

/** Faixa com os 3 números do mês: Entrou · Saiu · Sobrou. */
export function FaixaResumo({ entrou, saiu, sobrou, carregando }: { entrou: number; saiu: number; sobrou: number; carregando?: boolean }) {
  const itens = [
    { rotulo: 'Entrou', valor: entrou, cor: 'text-verde', icone: '⬆️' },
    { rotulo: 'Saiu', valor: saiu, cor: 'text-vermelho', icone: '⬇️' },
    { rotulo: 'Sobrou', valor: sobrou, cor: sobrou >= 0 ? 'text-verde' : 'text-vermelho', icone: sobrou >= 0 ? '✅' : '⚠️' },
  ]
  return (
    <div className="card grid grid-cols-3 divide-x divide-borda" role="group" aria-label="Resumo do mês">
      {itens.map((i) => (
        <div key={i.rotulo} className="px-1 py-3 text-center min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-suave flex items-center justify-center gap-1">
            <span aria-hidden>{i.icone}</span>{i.rotulo}
          </div>
          <div className={`font-extrabold text-[0.82rem] sm:text-lg mt-1 tabular-nums leading-tight break-words ${i.cor} ${carregando ? 'opacity-40' : ''}`}>{moeda(i.valor)}</div>
        </div>
      ))}
    </div>
  )
}
