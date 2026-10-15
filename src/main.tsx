import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLiteMotion } from './utils/motion.ts';
import { installSafeAreaFallback } from './utils/safeAreaFallback.ts';
import './index.css';

/** Stops a stale chunk from reloading the page in a loop. Cleared once this boot paints. */
const PRELOAD_RELOAD_KEY = 'uniplan-preload-reload';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1');
  } catch {
    return;
  }
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

// This document loaded. A later stale chunk in the same session may reload once.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    try {
      sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
    } catch {
      /* sessionStorage can throw in private mode */
    }
  });
});
