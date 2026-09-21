export type ThemeRevealOrigin = {
  x: number;
  y: number;
};

export type ThemeRevealOptions = {
  event: {
    clientX: number;
    clientY: number;
    currentTarget: EventTarget | null;
  };
  goingToDark: boolean;
  apply: () => void;
  commit: () => void;
};

const FAILSAFE_MS = 2000;

type ThemeViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type ActiveReveal = {
  transition: ThemeViewTransition | null;
  finish: () => void;
};

let activeReveal: ActiveReveal | null = null;
let failsafe = 0;
let pendingFrame = 0;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readDurationMs(token: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (raw.endsWith('ms')) {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  }
  if (raw.endsWith('s')) {
    const value = Number.parseFloat(raw) * 1000;
    return Number.isFinite(value) ? value : fallback;
  }
  return fallback;
}

function readEase(token: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw || 'cubic-bezier(0.22, 1, 0.36, 1)';
}

function viewMetrics(): { width: number; height: number; left: number; top: number } {
  const g = globalThis as typeof globalThis & {
    visualViewport?: { width: number; height: number; offsetLeft?: number; offsetTop?: number };
    innerWidth?: number;
    innerHeight?: number;
  };
  const vv = g.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      width: vv.width,
      height: vv.height,
      left: vv.offsetLeft ?? 0,
      top: vv.offsetTop ?? 0,
    };
  }
  return { width: g.innerWidth ?? 0, height: g.innerHeight ?? 0, left: 0, top: 0 };
}

function farthestCornerRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

function circleClip(radiusPx: number, x: number, y: number): string {
  return `circle(${Math.max(0, radiusPx).toFixed(2)}px at ${x.toFixed(2)}px ${y.toFixed(2)}px)`;
}

function clearRevealClasses(): void {
  document.documentElement.classList.remove(
    'is-theme-revealing',
    'is-theme-to-dark',
    'is-theme-to-light'
  );
}

function canStartViewTransition(
  doc: Document
): doc is Document & { startViewTransition: (update: () => void) => ThemeViewTransition } {
  return typeof (doc as Document & { startViewTransition?: unknown }).startViewTransition === 'function';
}

function extendTransition(transition: ThemeViewTransition, promise: Promise<unknown>): void {
  if (typeof transition.waitUntil === 'function') {
    transition.waitUntil(promise);
  }
}

function armFailsafe(finish: () => void): void {
  window.clearTimeout(failsafe);
  failsafe = window.setTimeout(finish, FAILSAFE_MS);
}

/**
 * Pointer-origin circular swap on View Transition bitmaps.
 * Flatten chrome, capture both themes, then clip the snapshots with circle().
 * Never clips live #root. Keyboard and reduced-motion callers must skip this.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { event, goingToDark, apply, commit } = options;

  if (prefersReducedMotion() || !canStartViewTransition(document)) {
    apply();
    commit();
    return;
  }

  if (activeReveal) {
    if (activeReveal.transition && typeof activeReveal.transition.skipTransition === 'function') {
      try {
        activeReveal.transition.skipTransition();
      } catch {
        activeReveal.finish();
      }
      return;
    }
    activeReveal.finish();
    return;
  }

  const origin = originFromPointer(event);
  const root = document.documentElement;
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  let applied = false;
  let committed = false;
  let released = false;

  const runApply = () => {
    if (applied) return;
    applied = true;
    apply();
  };

  const runCommit = () => {
    runApply();
    if (committed) return;
    committed = true;
    commit();
  };

  const finish = () => {
    if (released) return;
    released = true;
    window.clearTimeout(failsafe);
    window.cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    runCommit();
    clearRevealClasses();
    activeReveal = null;
  };

  activeReveal = {
    transition: null,
    finish,
  };
  armFailsafe(finish);

  pendingFrame = window.requestAnimationFrame(() => {
    pendingFrame = 0;
    if (released || activeReveal == null) return;

    try {
      const transition = document.startViewTransition(() => {
        runApply();
      });
      activeReveal.transition = transition;
      armFailsafe(finish);

      void transition.ready
        .then(() => {
          if (released) return;
          const { width, height } = viewMetrics();
          const endRadius = Math.max(1, farthestCornerRadius(origin.x, origin.y, width, height));
          const start = circleClip(0, origin.x, origin.y);
          const stop = circleClip(endRadius, origin.x, origin.y);
          const animation = root.animate(
            { clipPath: goingToDark ? [start, stop] : [stop, start] },
            {
              duration: goingToDark
                ? readDurationMs('--dur-scene', 620)
                : readDurationMs('--dur-emphasis', 500),
              easing: readEase('--ease-out'),
              fill: 'both',
              pseudoElement: goingToDark
                ? '::view-transition-new(root)'
                : '::view-transition-old(root)',
            }
          );
          extendTransition(transition, animation.finished);
        })
        .catch(() => {
          runApply();
        });

      void transition.finished.then(finish, finish);
    } catch {
      finish();
    }
  });
}

export function originRelativeTo(
  container: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number } },
  event: { clientX: number; clientY: number; currentTarget: EventTarget | null }
): ThemeRevealOrigin {
  const frame = container.getBoundingClientRect();
  const target = event.currentTarget;
  if (
    typeof target === 'object' &&
    target !== null &&
    'getBoundingClientRect' in target &&
    typeof target.getBoundingClientRect === 'function'
  ) {
    const box = target.getBoundingClientRect();
    return {
      x: box.left + box.width / 2 - frame.left,
      y: box.top + box.height / 2 - frame.top,
    };
  }

  if (event.clientX !== 0 || event.clientY !== 0) {
    return { x: event.clientX - frame.left, y: event.clientY - frame.top };
  }

  return { x: frame.width / 2, y: frame.height / 2 };
}

export function originFromPointer(event: {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
}): ThemeRevealOrigin {
  const { width, height, left, top } = viewMetrics();
  return originRelativeTo(
    { getBoundingClientRect: () => ({ left, top, width, height }) },
    event
  );
}

export function isPointerClick(event: { detail: number }): boolean {
  return event.detail > 0;
}
