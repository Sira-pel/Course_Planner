import { useLayoutEffect, useSyncExternalStore } from 'react';
import {
  layoutFromMatchMedia,
  stabilizePoolLayout,
  type PoolLayout,
} from './layoutBreakpoint';

export type { PoolLayout };

function readLayout(): PoolLayout {
  if (typeof window === 'undefined') return 'desktop';
  return layoutFromMatchMedia(
    window.matchMedia('(max-width: 639px)').matches,
    window.matchMedia('(min-width: 640px) and (max-width: 1023px)').matches
  );
}

let currentLayout: PoolLayout = readLayout();
const listeners = new Set<() => void>();
let listenersInitialized = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function initListeners() {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  const phone = window.matchMedia('(max-width: 639px)');
  const tablet = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
  let raf = 0;

  const onChange = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const raw = layoutFromMatchMedia(phone.matches, tablet.matches);
      const next = stabilizePoolLayout(window.innerWidth, currentLayout, raw);
      if (next !== currentLayout) {
        currentLayout = next;
        notify();
      }
    });
  };

  phone.addEventListener('change', onChange);
  tablet.addEventListener('change', onChange);
  // matchMedia only fires when a query flips. After hysteresis keeps the
  // previous layout, further resizing inside that same query would otherwise
  // leave the desktop rail (or phone sheet) stuck across the whole range.
  window.addEventListener('resize', onChange);
}

function subscribe(listener: () => void): () => void {
  initListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePoolLayout(): PoolLayout {
  const layout = useSyncExternalStore(subscribe, () => currentLayout, (): PoolLayout => 'desktop');
  useLayoutEffect(() => {
    document.documentElement.dataset.upLayout = layout;
  }, [layout]);
  return layout;
}

export function useIsPhone(): boolean {
  return usePoolLayout() === 'phone';
}
