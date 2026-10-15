import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLiteMotion } from './utils/motion.ts';
import { installSafeAreaFallback } from './utils/safeAreaFallback.ts';
import { isIdleDialogPrefetch } from './components/app/dialogLoaders.ts';
import './index.css';

/** Timestamp of the last preload reload. At most one reload per 30 seconds. */
const PRELOAD_RELOAD_KEY = 'uniplan-preload-reload';
const PRELOAD_RELOAD_WINDOW_MS = 30_000;

function lastPreloadReloadAt(): number | null {
  try {
    const raw = sessionStorage.getItem(PRELOAD_RELOAD_KEY);
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

window.addEventListener('vite:preloadError', (event) => {
  // Idle prefetch swallows its own rejection, so only a user-started import reloads.
  if (isIdleDialogPrefetch()) return;
  // Offline imports should reject into the dialog error UI.
  if (!navigator.onLine) return;

  const last = lastPreloadReloadAt();
  if (last !== null && Date.now() - last < PRELOAD_RELOAD_WINDOW_MS) return;

  try {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

installSafeAreaFallback();
initLiteMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>
);
