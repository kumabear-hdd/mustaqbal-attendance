import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import './index.css';

try {
  registerSW({
    immediate: true,
    onRegisterError(err) {
      console.warn('PWA service worker registration skipped:', err);
    },
  });
} catch (err) {
  console.warn('PWA service worker initialization skipped:', err);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
