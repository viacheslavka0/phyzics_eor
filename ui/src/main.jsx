import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Portal from './Portal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Portal />
  </StrictMode>,
)
