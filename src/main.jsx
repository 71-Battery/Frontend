import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {
  EMAIL_CONFIRMATION_PATH,
  resolveInitialRoute,
} from './api/emailConfirmation.js'

const initialRoute = resolveInitialRoute(window.location)

if (initialRoute.kind === 'redirect') {
  window.location.replace('/')
} else {
  if (initialRoute.kind === 'email-confirmation') {
    window.history.replaceState(null, '', EMAIL_CONFIRMATION_PATH)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App initialRoute={initialRoute} />
    </StrictMode>,
  )
}
