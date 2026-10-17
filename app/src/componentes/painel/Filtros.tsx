import type { Usuario } from '../../tipos'
import { MESES, MESES_CURTOS } from '../../util/formato'
import { Avatar } from '../inicio/Avatar'

/**
 * Barra de filtros do painel: no celular é uma faixa no topo (chips roláveis);
 * no computador (lg) vira a barra lateral à esquerda do grid, como na referência.
 */
export function Filtros({ anos, ano, aoMudarAno, mes, aoMudarMes, usuarios, membro, aoMudarMembro }: {
  anos: number[]
  ano: number
  aoMudarAno: (a: number) => void
  mes: number
  aoMudarMes: (m: number) => void
  usuarios: Usuario[]
  membro: string
  aoMudarMembro: (id: string) => void
}) {
  const chip = (sel: boolean) => `botao !min-h-11 !px-3 !rounded-xl text-sm shrink-0 ${sel ? 'bg-primaria-sel text-white' : 'botao-secundario'}`
  return (
    <aside className="lg:w-60 lg:shrink-0 lg:sticky lg:top-4 lg:self-start space-y-3" aria-label="Filtros do painel">
      <div className="hidden lg:block px-1">
        <div className="text-xl font-extrabold leading-tight">Finanças da Família</div>
        <div className="text-xs text-suave">Painel do ano</div>
      </div>

      <div>
        <div className="titulo-secao mb-1.5 px-1">Ano</div>
        <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap" role="radiogroup" aria-label="Ano">
          {anos.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={ano === a} className={chip(ano === a)} onClick={() => aoMudarAno(a)}>{a}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="titulo-secao mb-1.5 px-1">Mês</div>
        <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3" role="radiogroup" aria-label="Mês">
          {MESES.map((nome, i) => (
            <button key={nome} type="button" role="radio" aria-checked={mes === i + 1} className={chip(mes === i + 1)} onClick={() => aoMudarMes(i + 1)} aria-label={nome}>
              <span className="lg:hidden">{nome}</span><span className="hidden lg:inline">{MESES_CURTOS[i]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="titulo-secao mb-1.5 px-1">Membro</div>
        <div className="flex gap-2 overflow-x-auto rolagem-escondida -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap" role="radiogroup" aria-label="Membro">
          <button type="button" role="radio" aria-checked={membro === ''} className={chip(membro === '')} onClick={() => aoMudarMembro('')}><span aria-hidden>👨‍👩‍👧‍👦</span> Todos</button>
          {usuarios.filter((u) => u.ativo).map((u) => (
            <button key={u.id} type="button" role="radio" aria-checked={membro === u.id} className={`${chip(membro === u.id)} !pl-1.5`} onClick={() => aoMudarMembro(u.id)}>
              <Avatar usuario={u} tamanho={28} /> {u.apelido}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
