import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLiteMotion } from './utils/motion.ts';
import { installSafeAreaFallback } from './utils/safeAreaFallback.ts';
import './index.css';

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
