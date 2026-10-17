import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSessao } from '../store/sessao'
import { Avisos } from './Avisos'

const ITENS = [
  { para: '/', icone: '🏠', nome: 'Início' },
  { para: '/painel', icone: '📊', nome: 'Painel', soAdulto: true },
  { para: '/caixa', icone: '📥', nome: 'Caixa' },
  { para: '/sonhos', icone: '✈️', nome: 'Sonhos' },
  { para: '/mais', icone: '☰', nome: 'Mais' },
]

/** Esqueleto: barra inferior no celular, barra lateral no computador, FAB "+". */
export function Layout() {
  const pendentes = useSessao((e) => e.pendentesCaixa)
  const filaOffline = useSessao((e) => e.filaOffline)
  const online = useSessao((e) => e.online)
  const boot = useSessao((e) => e.boot)
  const nav = useNavigate()
  const loc = useLocation()
  const ehJunior = boot?.usuario.perfil === 'Júnior'
  const itens = ITENS.filter((i) => !(i.soAdulto && ehJunior))
  const esconderFab = /^\/(lancar|entrar|painel)/.test(loc.pathname)

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra lateral (computador) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-app border-r border-borda p-4 gap-1 sticky top-0 h-dvh">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          {boot?.config.url_brasao ? <img src={boot.config.url_brasao} alt="" className="w-9 h-9 rounded" /> : <span className="text-2xl">🏡</span>}
          <div>
            <div className="font-extrabold leading-tight">Finanças da Família</div>
            <div className="text-xs text-suave">{boot?.config.nome_familia}</div>
          </div>
        </div>
        {itens.map((i) => (
          <NavLink key={i.para} to={i.para} end={i.para === '/'} className={({ isActive }) => `botao justify-start gap-3 ${isActive ? 'bg-primaria-sel text-white' : 'botao-fantasma'}`}>
            <span className="text-xl" aria-hidden>{i.icone}</span>
            <span>{i.nome}</span>
            {i.para === '/caixa' && pendentes > 0 && <span className="ml-auto bg-vermelho text-white text-xs font-bold rounded-full px-2 py-0.5">{pendentes}</span>}
          </NavLink>
        ))}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {!online && (
          <div className="bg-amarelo text-black text-sm text-center py-1.5 px-3 font-medium area-segura-topo">
            📴 Sem internet — os lançamentos ficam guardados e sobem depois{filaOffline ? ` (${filaOffline} na fila)` : ''}.
          </div>
        )}
        <main className="flex-1 pb-28 lg:pb-8">
          <Outlet />
        </main>

        {/* Barra inferior (celular) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-app/95 backdrop-blur border-t border-borda area-segura-base" aria-label="Navegação principal">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${itens.length}, 1fr)` }}>
            {itens.map((i) => (
              <NavLink key={i.para} to={i.para} end={i.para === '/'} className={({ isActive }) => `relative flex flex-col items-center justify-center gap-0.5 min-h-16 text-xs font-medium ${isActive ? 'text-primaria-sel' : 'text-suave'}`}>
                <span className="text-2xl leading-none" aria-hidden>{i.icone}</span>
                <span>{i.nome}</span>
                {i.para === '/caixa' && pendentes > 0 && (
                  <span className="absolute top-2 right-[calc(50%-22px)] bg-vermelho text-white text-[11px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center" aria-label={`${pendentes} pendentes`}>{pendentes}</span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {!esconderFab && (
          <button className="fab" onClick={() => nav('/lancar')} aria-label="Lançar um gasto">+</button>
        )}
      </div>
      <Avisos />
    </div>
  )
}
