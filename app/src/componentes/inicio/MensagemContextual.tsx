import type { Categoria, ResumoMes } from '../../tipos'

/**
 * Mensagem leve conforme o mês (só com a seção Fé ativa):
 *  - mês positivo → gratidão;
 *  - categoria estourada → Hebreus 13:5 com encorajamento (nunca culpa).
 */
export function MensagemContextual({ resumo, categorias }: { resumo: ResumoMes; categorias: Categoria[] }) {
  const estouradas = Object.entries(resumo.por_categoria)
    .filter(([, v]) => v.orcado > 0 && v.realizado > v.orcado)
    .map(([id]) => categorias.find((c) => c.id === id))
    .filter((c): c is Categoria => !!c)

  if (estouradas.length) {
    const nomes = estouradas.slice(0, 2).map((c) => `${c.icone} ${c.nome}`).join(' e ')
    return (
      <div className="card p-4 border-l-4 border-l-amarelo">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{nomes}</span> {estouradas.length === 1 ? 'passou' : 'passaram'} do planejado este mês. Tudo bem: o que importa é olhar junto e ajustar com calma.
        </p>
        <p className="text-sm text-suave italic mt-2">“Sejam as vossas vidas sem avareza, contentando-vos com o que tendes; porque ele disse: Não te deixarei, nem te desampararei.” — Hebreus 13:5</p>
      </div>
    )
  }

  if (resumo.sobrou > 0 && resumo.entrou > 0) {
    return (
      <div className="card p-4 border-l-4 border-l-verde">
        <p className="text-sm leading-snug"><span aria-hidden>🙌</span> O mês está positivo. Que bom poder agradecer pela provisão e cuidar bem do que foi confiado a nós.</p>
        <p className="text-sm text-suave italic mt-2">“Toda boa dádiva e todo dom perfeito vêm do alto.” — Tiago 1:17</p>
      </div>
    )
  }
  return null
}
