import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { log } from './utils/logger.js'

// Register service worker
if (import.meta.env.DEV) {
  // During dev, register root-served dev SW so /oss/* works
  navigator.serviceWorker?.register('/sw-dev.js', { scope: '/', type: 'module' })
    .then(registration => {
      log.info('[MAIN] Service worker registered:', registration.scope)
      log.info('[MAIN] SW script URL:', registration.installing?.scriptURL || registration.active?.scriptURL)
      log.info('[MAIN] Current page URL:', window.location.href)
    })
    .catch(err => {
      log.error('[MAIN] Service worker registration failed:', err)
    })

  // Listen for messages from SW
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data.type === 'sw-log') {
      const logFn = log[event.data.level] || log.info
      logFn('[SW]', event.data.message)
    }
  })
}

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <App />
  // </StrictMode>
)
