import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Service worker: atualiza sozinho quando há versão nova.
registerSW({
  immediate: true,
  // Procura versão nova de hora em hora enquanto o app fica aberto (o celular costuma manter o app dias sem recarregar).
  onRegisteredSW(_url, registro) { if (registro) setInterval(() => registro.update().catch(() => {}), 60 * 60 * 1000) },
})

// Tela em branco depois de uma atualização: a página antiga tenta carregar um pedaço de código que já
// não existe no servidor. Recarrega uma vez para pegar a versão nova (sem entrar em laço).
window.addEventListener('vite:preloadError', (evento) => {
  evento.preventDefault()
  const chave = 'ff_recarregou_apos_erro'
  try {
    if (sessionStorage.getItem(chave) === '1') return
    sessionStorage.setItem(chave, '1')
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload()
})

// Links que chegam com os dados ANTES do # (ex.: .../?c=XXXX). WhatsApp, e-mail e alguns apps cortam ou
// alteram o que vem depois do #, então o convite e o "outro aparelho" usam esta forma; aqui viram a rota.
{
  const q = new URLSearchParams(window.location.search)
  if (q.has('c') || q.has('convite')) {
    window.history.replaceState(null, '', `${window.location.pathname}#/entrar?${q.toString()}`)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
