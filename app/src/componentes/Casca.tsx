/**
 * Casca do app, igual à referência: barra lateral azul-noite (240 px) no computador;
 * no celular (≤ 760 px), cabeçalho com brasão, nome, ano e meses em faixa rolável,
 * e barra inferior Painel · Contas · [+] · Projetos · Assistente.
 */
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSessao } from '../store/sessao'
import { Avisos } from './Avisos'
import { Icone } from './Icone'
import { Crest } from './Brasao'
import { MESES } from '../util/formato'

const NAV = [
  { para: '/', icone: 'layout-grid', nome: 'Painel' },
  { para: '/lancar', icone: 'circle-plus', nome: 'Lançar despesa' },
  { para: '/contas', icone: 'calendar-clock', nome: 'Contas a pagar', contador: 'contas' as const, soAdulto: true },
  { para: '/projetos', icone: 'target', nome: 'Projetos' },
  { para: '/assistente', icone: 'message-square', nome: 'Assistente' },
  { para: '/caixa', icone: 'inbox', nome: 'Caixa de entrada', contador: 'caixa' as const },
  { para: '/configuracoes', icone: 'settings', nome: 'Configurações' },
]

function Filtros() {
  const filtros = useSessao((e) => e.filtros)
  const setFiltros = useSessao((e) => e.setFiltros)
  const boot = useSessao((e) => e.boot)
  const anoAtual = new Date().getFullYear()
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual]
  const ehDependente = boot?.usuario.perfil === 'Dependente'
  return (
    <>
      <div><div className="group-t">Ano</div>
        <div className="years">{anos.map((a) => <button key={a} className="pick num" aria-pressed={filtros.ano === a} onClick={() => setFiltros({ ano: a })}>{a}</button>)}</div>
      </div>
      <div><div className="group-t">Mês</div>
        <div className="months">{MESES.map((m, i) => <button key={m} className="pick" aria-pressed={filtros.mes === i + 1} onClick={() => setFiltros({ mes: i + 1 })}>{m}</button>)}</div>
      </div>
      {!ehDependente && (
        <div><div className="group-t">Visão</div>
          <select className="member" aria-label="Membro da família" value={filtros.membro} onChange={(e) => setFiltros({ membro: e.target.value })}>
            <option value="">Toda a família</option>
            {boot?.usuarios.filter((u) => u.ativo).map((u) => <option key={u.id} value={u.id}>{u.apelido}</option>)}
          </select>
        </div>
      )}
    </>
  )
}

export function Casca() {
  const boot = useSessao((e) => e.boot)
  const pendentes = useSessao((e) => e.pendentesCaixa)
  const contas = useSessao((e) => e.contasAPagar)
  const filtros = useSessao((e) => e.filtros)
  const setFiltros = useSessao((e) => e.setFiltros)
  const online = useSessao((e) => e.online)
  const filaOffline = useSessao((e) => e.filaOffline)
  const nav = useNavigate()
  const loc = useLocation()
  const ehDependente = boot?.usuario.perfil === 'Dependente'
  const itens = NAV.filter((i) => !(i.soAdulto && ehDependente))
  const contador = (c?: 'contas' | 'caixa') => (c === 'contas' ? contas : c === 'caixa' ? pendentes : 0)
  const anoAtual = new Date().getFullYear()
  const config = boot?.config

  return (
    <div className="app">
      <aside className="side" aria-label="Filtros e navegação">
        <div className="brand">
          <Crest url={config?.url_brasao} foto={config?.url_foto_capa} />
          <div><h1>Finanças da Família</h1><small>{config?.nome_familia}</small></div>
        </div>
        {config?.fe_ativa !== false && (
          <p className="verse">{config?.versiculo_lema?.split('—')[0]?.trim() || '“Eu e a minha casa serviremos ao Senhor.”'}<b>{config?.versiculo_lema?.split('—')[1]?.trim() || 'Josué 24.15'}</b></p>
        )}
        <Filtros />
        <nav className="nav" aria-label="Seções">
          {itens.map((i) => (
            <NavLink key={i.para} to={i.para} end={i.para === '/'} aria-current={undefined} className={({ isActive }) => (isActive ? 'ativo' : '')} {...{}}>
              {({ isActive }) => (
                <span aria-current={isActive ? 'page' : undefined} style={{ display: 'contents' }}>
                  <Icone nome={i.icone} />{i.nome}
                  {contador(i.contador) > 0 && <span className="badge num">{contador(i.contador)}</span>}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="conteudo">
        <header className="mhead">
          <div className="brand">
            <div>
              <Crest url={config?.url_brasao} foto={config?.url_foto_capa} />
              <div><h1>Finanças da Família</h1><small>{config?.nome_familia}</small></div>
            </div>
            <select aria-label="Ano" value={filtros.ano} onChange={(e) => setFiltros({ ano: Number(e.target.value) })}>
              {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="mscroll" role="tablist" aria-label="Mês">
            {MESES.map((m, i) => <button key={m} role="tab" className="pick" aria-pressed={filtros.mes === i + 1} aria-selected={filtros.mes === i + 1} onClick={() => setFiltros({ mes: i + 1 })}>{m}</button>)}
          </div>
        </header>

        {!online && (
          <div className="card" style={{ padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--gold)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nome="alert-circle" /> Sem internet. Os lançamentos ficam guardados e sobem quando a conexão voltar{filaOffline ? ` (${filaOffline} na fila)` : ''}.
          </div>
        )}
        <Outlet />
      </main>

      <nav className="bottom" aria-label="Seções">
        <NavLink to="/" end>{({ isActive }) => <span aria-current={isActive ? 'page' : undefined} style={{ display: 'contents' }}><Icone nome="layout-grid" />Painel</span>}</NavLink>
        <NavLink to={ehDependente ? '/caixa' : '/contas'}>{({ isActive }) => <span aria-current={isActive ? 'page' : undefined} style={{ display: 'contents' }}><Icone nome={ehDependente ? 'inbox' : 'calendar-clock'} />{ehDependente ? 'Caixa' : 'Contas'}</span>}</NavLink>
        <button onClick={() => nav('/lancar')} aria-label="Lançar despesa" aria-current={loc.pathname.startsWith('/lancar') ? 'page' : undefined}><span className="plus"><Icone nome="plus" /></span></button>
        <NavLink to="/projetos">{({ isActive }) => <span aria-current={isActive ? 'page' : undefined} style={{ display: 'contents' }}><Icone nome="target" />Projetos</span>}</NavLink>
        <NavLink to="/assistente">{({ isActive }) => <span aria-current={isActive ? 'page' : undefined} style={{ display: 'contents' }}><Icone nome="message-square" />Assistente</span>}</NavLink>
      </nav>
      <Avisos />
    </div>
  )
}
