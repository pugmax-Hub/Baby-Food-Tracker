import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initMockApi } from './mockApi'

// Initialize fallback mock API if running in a standard web browser without Electron
if (typeof window !== 'undefined' && !window.api) {
  initMockApi()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
