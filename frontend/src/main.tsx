import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ConnectedApp from './connected/ConnectedApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.VITE_PORTAL_MODE === 'api' ? <ConnectedApp /> : <App />}
  </StrictMode>,
)
