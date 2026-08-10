import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './themeContrast.css'
import { installDesktopExternalLinkHandler } from './services/desktopSecurity.ts'

installDesktopExternalLinkHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
