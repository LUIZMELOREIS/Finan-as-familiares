import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSessao } from './store/sessao'
import { Layout } from './componentes/Layout'
import { Carregando } from './componentes/Carregando'

// Carregamento preguiçoso: cada tela só é baixada quando aberta.
const Inicio = lazy(() => import('./paginas/Inicio'))
const Grupo = lazy(() => import('./paginas/Grupo'))
const Lancar = lazy(() => import('./paginas/Lancar'))
const Painel = lazy(() => import('./paginas/Painel'))
const CaixaEntrada = lazy(() => import('./paginas/CaixaEntrada'))
const Sonhos = lazy(() => import('./paginas/Sonhos'))
const Projeto = lazy(() => import('./paginas/Projeto'))
const Conselho = lazy(() => import('./paginas/Conselho'))
const Reuniao = lazy(() => import('./paginas/Reuniao'))
const Contas = lazy(() => import('./paginas/Contas'))
const Mais = lazy(() => import('./paginas/Mais'))
const Configuracoes = lazy(() => import('./paginas/Configuracoes'))
const Entrar = lazy(() => import('./paginas/Entrar'))
const Mesada = lazy(() => import('./paginas/Mesada'))
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

  if (carregando) return <div className="min-h-dvh flex items-center justify-center"><Carregando texto="Abrindo o app da família…" /></div>

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
              <Route path="/lancar" element={<Lancar />} />
              <Route element={<Layout />}>
                <Route index element={<Inicio />} />
                <Route path="/grupo/:id" element={<Grupo />} />
                <Route path="/painel" element={<Painel />} />
                <Route path="/caixa" element={<CaixaEntrada />} />
                <Route path="/sonhos" element={<Sonhos />} />
                <Route path="/sonhos/:id" element={<Projeto />} />
                <Route path="/conselho" element={<Conselho />} />
                <Route path="/reuniao" element={<Reuniao />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/mesada" element={<Mesada />} />
                <Route path="/mais" element={<Mais />} />
                <Route path="/configuracoes/*" element={<Configuracoes />} />
                <Route path="/brasao" element={<Brasao />} />
                <Route path="/captura" element={<CapturaAutomatica />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </>
          )}
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
