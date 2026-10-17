import type { Bloco, Trecho } from './markdown'

/** Desenha os trechos de uma linha (negrito/itálico/texto). */
export function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.tipo === 'negrito' ? <strong key={i}>{t.texto}</strong> : t.tipo === 'italico' ? <em key={i} className="text-suave">{t.texto}</em> : <span key={i}>{t.texto}</span>,
      )}
    </>
  )
}

/** Desenha uma lista de blocos já analisados (itens viram lista, citação vira destaque). */
export function Blocos({ blocos }: { blocos: Bloco[] }) {
  const saida: React.ReactNode[] = []
  let itens: Bloco[] = []
  const fecharLista = () => {
    if (!itens.length) return
    saida.push(
      <ul key={`ul-${saida.length}`} className="space-y-1.5 pl-1">
        {itens.map((b, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span className="text-primaria-sel shrink-0" aria-hidden>•</span>
            <span><Trechos trechos={b.trechos} /></span>
          </li>
        ))}
      </ul>,
    )
    itens = []
  }
  blocos.forEach((b, i) => {
    if (b.tipo === 'item') {
      itens.push(b)
      return
    }
    fecharLista()
    if (b.tipo === 'h1') saida.push(<h2 key={i} className="text-xl font-extrabold"><Trechos trechos={b.trechos} /></h2>)
    else if (b.tipo === 'h2') saida.push(<h3 key={i} className="text-lg font-bold"><Trechos trechos={b.trechos} /></h3>)
    else if (b.tipo === 'h3') saida.push(<h4 key={i} className="font-bold"><Trechos trechos={b.trechos} /></h4>)
    else if (b.tipo === 'citacao') saida.push(<blockquote key={i} className="border-l-4 border-amarelo pl-3 py-1 italic leading-relaxed"><Trechos trechos={b.trechos} /></blockquote>)
    else saida.push(<p key={i} className="leading-relaxed"><Trechos trechos={b.trechos} /></p>)
  })
  fecharLista()
  return <div className="space-y-2">{saida}</div>
}
