import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSessao } from './store/sessao'
import { Casca } from './componentes/Casca'
import { Carregando } from './componentes/Carregando'

// Carregamento preguiçoso: cada tela só é baixada quando aberta.
const Painel = lazy(() => import('./paginas/Painel'))
const Tipo = lazy(() => import('./paginas/Tipo'))
const Lancar = lazy(() => import('./paginas/Lancar'))
const Contas = lazy(() => import('./paginas/Contas'))
const Projetos = lazy(() => import('./paginas/Projetos'))
const Projeto = lazy(() => import('./paginas/Projeto'))
const Assistente = lazy(() => import('./paginas/Assistente'))
const CaixaEntrada = lazy(() => import('./paginas/CaixaEntrada'))
const Conselho = lazy(() => import('./paginas/Conselho'))
const Reuniao = lazy(() => import('./paginas/Reuniao'))
const Patrimonio = lazy(() => import('./paginas/Patrimonio'))
const Mesada = lazy(() => import('./paginas/Mesada'))
const Configuracoes = lazy(() => import('./paginas/Configuracoes'))
const Entrar = lazy(() => import('./paginas/Entrar'))
const Tutorial = lazy(() => import('./paginas/Tutorial'))
const Brasao = lazy(() => import('./paginas/Brasao'))
const CapturaAutomatica = lazy(() => import('./paginas/CapturaAutomatica'))

function RolarAoTopo() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  const iniciar = useSessao((e) => e.iniciar)
  const carregando = useSessao((e) => e.carregando)
  const sessao = useSessao((e) => e.sessao)
  const boot = useSessao((e) => e.boot)
  const erroBoot = useSessao((e) => e.erroBoot)
  const tutorialVisto = useSessao((e) => e.preferencias.tutorial_visto)

  useEffect(() => { iniciar() }, [iniciar])

  if (carregando) return <div className="capa"><Carregando texto="Abrindo o app da família…" /></div>

  return (
    <HashRouter>
      <RolarAoTopo />
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          {!sessao || !boot ? (
            <Route path="*" element={<Entrar erro={erroBoot ?? undefined} />} />
          ) : !tutorialVisto ? (
            <Route path="*" element={<Tutorial />} />
          ) : (
            <>
              <Route path="/tutorial" element={<Tutorial />} />
              <Route element={<Casca />}>
                <Route index element={<Painel />} />
                <Route path="/tipo/:id" element={<Tipo />} />
                <Route path="/lancar" element={<Lancar />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/projetos" element={<Projetos />} />
                <Route path="/projetos/:id" element={<Projeto />} />
                <Route path="/assistente" element={<Assistente />} />
                <Route path="/caixa" element={<CaixaEntrada />} />
                <Route path="/conselho" element={<Conselho />} />
                <Route path="/reuniao" element={<Reuniao />} />
                <Route path="/patrimonio" element={<Patrimonio />} />
                <Route path="/mesada" element={<Mesada />} />
                <Route path="/configuracoes/*" element={<Configuracoes />} />
                <Route path="/brasao" element={<Brasao />} />
                <Route path="/captura" element={<CapturaAutomatica />} />
                {/* rotas da versão 1 */}
                <Route path="/painel" element={<Navigate to="/" replace />} />
                <Route path="/sonhos" element={<Navigate to="/projetos" replace />} />
                <Route path="/mais" element={<Navigate to="/configuracoes" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </>
          )}
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
