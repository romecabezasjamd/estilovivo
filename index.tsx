import './src/polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import ErrorBoundary from './src/components/ErrorBoundary';
import { NotificationProvider } from './src/context/NotificationContext';
import { isStaleChunkError, recoverFromStaleBuild } from './src/utils/staleRecovery';

// Web antigua guardada en el móvil que pide trozos que ya no existen: se recupera sola con la versión nueva
// Sin preventDefault: si se cancela, Vite entrega "undefined" a React.lazy y sale "reading 'default'" en vez del error
// real; dejándolo pasar, ErrorBoundary lo reconoce como versión antigua, recarga y no lo registra como fallo.
window.addEventListener('vite:preloadError', () => { void recoverFromStaleBuild(); });
window.addEventListener('unhandledrejection', (event) => { if (isStaleChunkError(event.reason)) void recoverFromStaleBuild(); });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ErrorBoundary>
  </React.StrictMode>
);