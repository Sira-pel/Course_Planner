export type ThemeRevealOrigin = {
  x: number;
  y: number;
};

export type ThemeRevealOptions = {
  origin: ThemeRevealOrigin;
  goingToDark: boolean;
  apply: () => void;
};

let revealBusy = false;

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

function farthestCornerRadius(x: number, y: number): number {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
}

function clearRevealClasses(): void {
  document.documentElement.classList.remove(
    'is-theme-revealing',
    'is-theme-to-dark',
    'is-theme-to-light'
  );
}

type ThemeViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  waitUntil?: (promise: Promise<unknown>) => void;
};

function canStartViewTransition(
  doc: Document
): doc is Document & {
  startViewTransition: (update: () => void) => ThemeViewTransition;
} {
  return typeof doc.startViewTransition === 'function';
}

function extendTransition(transition: ThemeViewTransition, promise: Promise<unknown>): void {
  if (typeof transition.waitUntil === 'function') {
    transition.waitUntil(promise);
  }
}

/**
 * Pointer-origin circular mask for a light/dark swap.
 * Keyboard and reduced-motion callers must skip this and just apply().
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { origin, goingToDark, apply } = options;

  if (revealBusy) {
    return;
  }

  if (prefersReducedMotion() || !canStartViewTransition(document)) {
    apply();
    return;
  }

  revealBusy = true;
  const root = document.documentElement;
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  let applied = false;
  const runApply = () => {
    if (applied) return;
    applied = true;
    apply();
  };

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    window.clearTimeout(failsafe);
    clearRevealClasses();
    revealBusy = false;
  };

  const failsafe = window.setTimeout(release, 2000);

  try {
    const transition = document.startViewTransition(() => {
      runApply();
    });

    void transition.ready
      .then(() => {
        const x = origin.x;
        const y = origin.y;
        const endRadius = farthestCornerRadius(x, y);
        const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

        const animation = root.animate(
          { clipPath: goingToDark ? clip : [clip[1], clip[0]] },
          {
            duration: goingToDark
              ? readDurationMs('--dur-scene', 620)
              : readDurationMs('--dur-emphasis', 500),
            easing: readEase('--ease-out'),
            fill: 'both',
            pseudoElement: goingToDark ? '::view-transition-new(root)' : '::view-transition-old(root)',
          }
        );
        extendTransition(transition, animation.finished);
      })
      .catch(() => {
        runApply();
      });

    void transition.finished.then(release, release);
  } catch {
    runApply();
    release();
  }
}

export function originFromPointer(event: {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
}): ThemeRevealOrigin {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return { x: event.clientX, y: event.clientY };
  }

  if (event.currentTarget instanceof Element) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

export function isPointerClick(event: { detail: number }): boolean {
  return event.detail > 0;
}
