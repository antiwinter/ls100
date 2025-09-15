import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register service worker
if (import.meta.env.DEV)
  // During dev, register root-served dev SW so /media/* works
  navigator.serviceWorker?.register('/sw-dev.js',
    { scope: '/', type: 'module' })

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <App />
  // </StrictMode>
)
