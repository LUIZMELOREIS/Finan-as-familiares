import { House, ReceiptText, ScanLine, Users } from 'lucide-react'

export type Aba = 'home' | 'extrato' | 'scanner' | 'membros'

const ABAS: { id: Aba; rotulo: string; Icone: typeof House }[] = [
  { id: 'home', rotulo: 'Início', Icone: House },
  { id: 'extrato', rotulo: 'Extrato', Icone: ReceiptText },
  { id: 'scanner', rotulo: 'Escanear', Icone: ScanLine },
  { id: 'membros', rotulo: 'Membros', Icone: Users },
]

/** ==== BARRA INFERIOR: 4 abas, botão central (Escanear) em destaque ==== */
export function BottomNav({ ativa, aoMudar }: { ativa: Aba; aoMudar: (a: Aba) => void }) {
  return (
    <nav className="nav" aria-label="Navegação principal">
      {ABAS.map(({ id, rotulo, Icone }) => {
        const central = id === 'scanner'
        return (
          <button key={id} type="button" className={central ? 'central' : undefined} aria-current={ativa === id ? 'page' : undefined} onClick={() => aoMudar(id)}>
            {central ? <span className="disco"><Icone size={26} aria-hidden="true" /></span> : <Icone size={24} aria-hidden="true" />}
            <span>{rotulo}</span>
          </button>
        )
      })}
    </nav>
  )
  /* ==== FIM DA BARRA INFERIOR ==== */
}
