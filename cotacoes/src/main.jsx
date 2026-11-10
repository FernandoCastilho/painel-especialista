import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary.jsx'
import App from './App.jsx'
import DynamicNotifications from './DynamicNotifications.jsx'
import AcessoPorEmail from './AcessoPorEmail.jsx'
import './styles.css'
import './Terminal.css'
import './Abas.css'
import './Theme.css'
import { iniciarContagem } from './acessos.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary><AcessoPorEmail><DynamicNotifications><App /></DynamicNotifications></AcessoPorEmail></ErrorBoundary>
  </StrictMode>,
)

// Service worker só em produção (no desenvolvimento atrapalha o recarregamento).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Se uma versão nova assumir o controle enquanto o app está aberto, a tela avisa (evento "app-update").
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => hadController && window.dispatchEvent(new Event('app-update')))
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

// Contagem anônima de acessos (Umami): só no site publicado.
iniciarContagem()
