export const SAFE_BOTTOM_VAR = '--up-safe-bottom';

export function installSafeAreaFallback(): () => void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.removeProperty(SAFE_BOTTOM_VAR);
  }
  return () => {};
}
