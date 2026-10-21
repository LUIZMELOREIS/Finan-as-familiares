import { Bell, Settings } from 'lucide-react'
import { mesReferencia } from '../utils/format'

interface Props { familia: string; pendentes: number; aoAbrirAvisos?: () => void; aoAbrirConfig?: () => void }

/** ==== CABEÇALHO: saudação + mês à esquerda, avisos e configurações à direita ==== */
export function Header({ familia, pendentes, aoAbrirAvisos, aoAbrirConfig }: Props) {
  return (
    <header className="header">
      <div>
        <h1>Olá, {familia}!</h1>
        <p className="mes">{mesReferencia()}</p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="icon-btn" aria-label={`Notificações, ${pendentes} contas pendentes`} onClick={aoAbrirAvisos}>
          <Bell size={22} />
          {pendentes > 0 && <span className="badge" aria-hidden="true">{pendentes}</span>}
        </button>
        <button type="button" className="icon-btn" aria-label="Configurações" onClick={aoAbrirConfig}>
          <Settings size={22} />
        </button>
      </div>
    </header>
  )
  /* ==== FIM DO CABEÇALHO ==== */
}
