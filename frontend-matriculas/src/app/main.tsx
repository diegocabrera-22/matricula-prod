import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import '../index.css'
import App from './App.tsx'
import { configurarInterceptorFetch } from '../config/setupFetchInterceptor'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Inicializar interceptor global para captura de tokens expirados (401)
configurarInterceptorFetch();

// Client ID de Google. Se lee de VITE_GOOGLE_CLIENT_ID (.env / .env.production).
// El fallback es el Client ID real del sistema para no romper el login si la
// variable de entorno faltara en el build.
const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  "498300607567-edt5c28askolgncq8t2pg6o39lhnlb0f.apps.googleusercontent.com";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)