export const SAFE_BOTTOM_FALLBACK_PX = 48;
/** Viewport already shorter than the screen by about a status bar plus nav bar. */
export const EDGE_TO_EDGE_GAP_PX = 80;
export const SAFE_BOTTOM_VAR = '--up-safe-bottom';

export interface SafeAreaSnapshot {
  standalone: boolean;
  portrait: boolean;
  insetBottomPx: number;
  screenGapPx: number;
}

/**
 * Chrome sometimes reports a zero bottom inset on a standalone cold start while
 * the page is still drawn edge-to-edge under the gesture bar. A non-zero inset,
 * or a viewport that is already shorter than the screen, means the system bar
 * is accounted for and no fallback is needed.
 */
export function safeBottomFallbackPx(snapshot: SafeAreaSnapshot): number {
  if (!snapshot.standalone) return 0;
  if (!snapshot.portrait) return 0;
  if (snapshot.insetBottomPx > 0) return 0;
  if (snapshot.screenGapPx >= EDGE_TO_EDGE_GAP_PX) return 0;
  return SAFE_BOTTOM_FALLBACK_PX;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function probeSafeAreaBottom(): number {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.documentElement.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return inset;
}

function applySafeAreaFallback(): void {
  const fallback = safeBottomFallbackPx({
    standalone: isStandalone(),
    portrait: window.innerHeight >= window.innerWidth,
    insetBottomPx: probeSafeAreaBottom(),
    screenGapPx: window.screen.height - window.innerHeight,
  });
  if (fallback > 0) {
    document.documentElement.style.setProperty(SAFE_BOTTOM_VAR, `${fallback}px`);
  } else {
    document.documentElement.style.removeProperty(SAFE_BOTTOM_VAR);
  }
}

export function installSafeAreaFallback(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  applySafeAreaFallback();
  const frame = requestAnimationFrame(applySafeAreaFallback);
  const timer = window.setTimeout(applySafeAreaFallback, 300);

  const onChange = () => applySafeAreaFallback();
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  window.addEventListener('pageshow', onChange);
  document.addEventListener('visibilitychange', onChange);

  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    window.removeEventListener('pageshow', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}
