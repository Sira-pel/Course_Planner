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

function rejectionMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason ?? '');
}

window.addEventListener('unhandledrejection', (event) => {
  // A prefetch or ?retry= import is recovered by the dialog. Don't report it as uncaught.
  const message = rejectionMessage(event.reason);
  const dynamicImportFailed =
    message.includes('dynamically imported module') || message.includes('Importing a module script failed');
  if (message.includes('retry=') || (isIdleDialogPrefetch() && dynamicImportFailed)) {
    event.preventDefault();
  }
});

window.addEventListener('vite:preloadError', (event) => {
  // Idle prefetch catches its own rejection. Leave the error intact so the loader
  // can read the failed URL. preventDefault would resolve the import to undefined.
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
