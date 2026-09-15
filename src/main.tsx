import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { initializeFirebase } from './config/firebase';
import App from './App.tsx';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { ToastProvider } from './shared/components/Toast';

initializeFirebase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);