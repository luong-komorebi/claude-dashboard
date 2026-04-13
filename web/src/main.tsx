import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getStoredThemeId } from './theme'

// Applies the stored theme on mount. The inline script in index.html
// already sets data-theme before paint (FOUC prevention); this call is
// a safety net that re-runs through the full apply logic and re-writes
// localStorage with the resolved value.
applyTheme(getStoredThemeId())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
