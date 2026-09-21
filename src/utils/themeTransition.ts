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
const KEYFRAME_COUNT = 60;
const DEFAULT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

function parseCubicBezier(ease: string): [number, number, number, number] {
  const match = ease.match(
    /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i
  );
  if (!match) return DEFAULT_EASE;
  const x1 = Number.parseFloat(match[1]);
  const y1 = Number.parseFloat(match[2]);
  const x2 = Number.parseFloat(match[3]);
  const y2 = Number.parseFloat(match[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return DEFAULT_EASE;
  return [x1, y1, x2, y2];
}

function cubic(t: number, a: number, b: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;
}

function cubicDerivative(t: number, a: number, b: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * a + 6 * mt * t * (b - a) + 3 * t * t * (1 - b);
}

function unitBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const current = cubic(t, x1, x2);
      const derivative = cubicDerivative(t, x1, x2);
      if (Math.abs(derivative) < 1e-6) break;
      t -= (current - x) / derivative;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    return cubic(t, y1, y2);
  };
}

function bakeScaleKeyframes(
  startScale: number,
  ease: (progress: number) => number,
  reverse: boolean
): { outer: Keyframe[]; inner: Keyframe[] } {
  const scales: number[] = [];
  for (let i = 0; i <= KEYFRAME_COUNT; i++) {
    const eased = ease(i / KEYFRAME_COUNT);
    scales.push(startScale + (1 - startScale) * eased);
  }
  if (reverse) scales.reverse();

  const outer: Keyframe[] = [];
  const inner: Keyframe[] = [];
  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i];
    const offset = i / KEYFRAME_COUNT;
    outer.push({ offset, transform: `scale(${scale})` });
    inner.push({ offset, transform: `scale(${1 / scale})` });
  }
  return { outer, inner };
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

function setRevealGeometry(x: number, y: number, radius: number, width: number, height: number): void {
  const root = document.documentElement;
  root.style.setProperty('--up-reveal-x', `${x}px`);
  root.style.setProperty('--up-reveal-y', `${y}px`);
  root.style.setProperty('--up-reveal-r', `${radius}px`);
  root.style.setProperty('--up-reveal-w', `${width}px`);
  root.style.setProperty('--up-reveal-h', `${height}px`);
}

function clearRevealGeometry(): void {
  const root = document.documentElement;
  root.style.removeProperty('--up-reveal-x');
  root.style.removeProperty('--up-reveal-y');
  root.style.removeProperty('--up-reveal-r');
  root.style.removeProperty('--up-reveal-w');
  root.style.removeProperty('--up-reveal-h');
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

function cancelAnimations(animations: Animation[]): void {
  for (const animation of animations) {
    try {
      animation.cancel();
    } catch {
      // Pseudo-element may already be gone with the View Transition.
    }
  }
}

/**
 * Pointer-origin circular swap on View Transition bitmaps.
 * Capture light/dark as named body groups, then scale a rounded-clip wrapper
 * with an inverse-scaled snapshot so only transform/opacity run on the compositor.
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

  const root = document.documentElement;
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  let applied = false;
  let committed = false;
  let released = false;
  const animations: Animation[] = [];

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
    cancelAnimations(animations);
    runCommit();
    clearRevealClasses();
    clearRevealGeometry();
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
          const bodyRect = document.body.getBoundingClientRect();
          const origin = originRelativeTo(document.body, event);
          const viewport = viewMetrics();
          const coverWidth = Math.max(bodyRect.width, viewport.width);
          const coverHeight = Math.max(bodyRect.height, viewport.height);
          const radius = Math.max(
            1,
            farthestCornerRadius(origin.x, origin.y, coverWidth, coverHeight)
          );
          const startScale = Math.min(1, 0.5 / radius);
          setRevealGeometry(origin.x, origin.y, radius, bodyRect.width, bodyRect.height);

          const ease = unitBezier(...parseCubicBezier(readEase('--ease-out')));
          const { outer, inner } = bakeScaleKeyframes(startScale, ease, !goingToDark);
          const duration = goingToDark
            ? readDurationMs('--dur-scene', 620)
            : readDurationMs('--dur-emphasis', 500);
          const timing: KeyframeAnimationOptions = {
            duration,
            easing: 'linear',
            fill: 'both',
          };

          const pairAnimation = root.animate(outer, {
            ...timing,
            pseudoElement: '::view-transition-image-pair(theme-dark)',
          });
          const imageAnimation = root.animate(inner, {
            ...timing,
            pseudoElement: goingToDark
              ? '::view-transition-new(theme-dark)'
              : '::view-transition-old(theme-dark)',
          });
          animations.push(pairAnimation, imageAnimation);
          extendTransition(
            transition,
            Promise.all([
              pairAnimation.finished.catch(() => undefined),
              imageAnimation.finished.catch(() => undefined),
            ])
          );
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
