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

export const SCALE_STEP_RATIO = 1.03;
const FAILSAFE_MS = 2000;
const EASE_INVERSE_ITERS = 40;
const GROUP_SIZE_SLOP_PX = 0.5;
const FALLBACK_START_RADIUS_PX = 8;
const MIN_START_RADIUS_PX = 0.5;
const DEFAULT_EASE: [number, number, number, number] = [0.3, 0.55, 0.3, 1];
const DEFAULT_EASE_CSS = 'cubic-bezier(0.3, 0.55, 0.3, 1)';

export type ScaleLadderFrame = {
  offset: number;
  scale: number;
};

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
let groupSizeWarned = false;

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
  return raw || DEFAULT_EASE_CSS;
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

export function unitBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
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

function easeInverse(ease: (progress: number) => number, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < EASE_INVERSE_ITERS; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function geometricScales(startScale: number): number[] {
  const scales: number[] = [];
  let scale = startScale;
  while (scale < 1) {
    scales.push(scale);
    scale *= SCALE_STEP_RATIO;
  }
  scales.push(1);
  return scales;
}

/**
 * Geometric scale ladder with easing in keyframe offsets, not in the scale steps.
 * Adjacent scale ratio is bounded by SCALE_STEP_RATIO so piecewise-linear
 * interpolation keeps outer×inner ≈ 1 between keyframes.
 */
export function geometricScaleLadder(
  startScale: number,
  ease: (progress: number) => number,
  shrink: boolean
): ScaleLadderFrame[] {
  const s0 = Math.min(1, Math.max(Number.EPSILON, startScale));
  if (s0 >= 1) {
    return [
      { offset: 0, scale: 1 },
      { offset: 1, scale: 1 },
    ];
  }

  const span = 1 - s0;
  const frames: ScaleLadderFrame[] = geometricScales(s0).map((scale) => {
    const growProgress = (scale - s0) / span;
    const easedProgress = shrink ? 1 - growProgress : growProgress;
    return { offset: easeInverse(ease, easedProgress), scale };
  });

  frames.sort((a, b) => a.offset - b.offset);
  frames[0].offset = 0;
  frames[frames.length - 1].offset = 1;
  if (shrink) {
    frames[0].scale = 1;
    frames[frames.length - 1].scale = s0;
  } else {
    frames[0].scale = s0;
    frames[frames.length - 1].scale = 1;
  }
  return frames;
}

function bakeScaleKeyframes(
  startScale: number,
  ease: (progress: number) => number,
  shrink: boolean
): { outer: Keyframe[]; inner: Keyframe[] } {
  const frames = geometricScaleLadder(startScale, ease, shrink);
  const outer: Keyframe[] = [];
  const inner: Keyframe[] = [];
  for (const frame of frames) {
    outer.push({ offset: frame.offset, transform: `scale(${frame.scale})` });
    inner.push({ offset: frame.offset, transform: `scale(${1 / frame.scale})` });
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

function startRadiusPxFromEvent(event: ThemeRevealOptions['event']): number {
  const target = event.currentTarget;
  if (
    typeof target === 'object' &&
    target !== null &&
    'getBoundingClientRect' in target &&
    typeof target.getBoundingClientRect === 'function'
  ) {
    const box = target.getBoundingClientRect();
    return Math.max(box.width, box.height) / 2;
  }
  return FALLBACK_START_RADIUS_PX;
}

function devicePx(value: number): number {
  const dpr = window.devicePixelRatio || 1;
  if (!Number.isFinite(value) || !Number.isFinite(dpr) || dpr <= 0) return value;
  return Math.round(value * dpr) / dpr;
}

function devicePxCeil(value: number): number {
  const dpr = window.devicePixelRatio || 1;
  if (!Number.isFinite(value) || !Number.isFinite(dpr) || dpr <= 0) return value;
  return Math.ceil(value * dpr - 1e-6) / dpr;
}

/** Gecko slides 1px borders when the snapshot is scaled and inverse-scaled. Clip instead. */
function isGeckoEngine(): boolean {
  return typeof navigator !== 'undefined' && /Gecko\//.test(navigator.userAgent);
}

function setRevealGeometry(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
  startScale: number,
  startRadiusPx: number
): void {
  const root = document.documentElement;
  root.style.setProperty('--up-reveal-x', `${x}px`);
  root.style.setProperty('--up-reveal-y', `${y}px`);
  root.style.setProperty('--up-reveal-r', `${radius}px`);
  root.style.setProperty('--up-reveal-w', `${width}px`);
  root.style.setProperty('--up-reveal-h', `${height}px`);
  root.style.setProperty('--up-reveal-s0', String(startScale));
  root.style.setProperty('--up-reveal-start', `${startRadiusPx}px`);
}

function clearRevealGeometry(): void {
  const root = document.documentElement;
  root.style.removeProperty('--up-reveal-x');
  root.style.removeProperty('--up-reveal-y');
  root.style.removeProperty('--up-reveal-r');
  root.style.removeProperty('--up-reveal-w');
  root.style.removeProperty('--up-reveal-h');
  root.style.removeProperty('--up-reveal-s0');
  root.style.removeProperty('--up-reveal-start');
  root.style.removeProperty('--up-reveal-clip');
}

function publishRevealGeometry(event: ThemeRevealOptions['event'], startRadiusPx: number): number {
  const bodyRect = document.body.getBoundingClientRect();
  const origin = originRelativeTo(document.body, event);
  const viewport = viewMetrics();
  const x = devicePx(origin.x);
  const y = devicePx(origin.y);
  const width = devicePx(bodyRect.width);
  const height = devicePx(bodyRect.height);
  const radius = devicePxCeil(
    Math.max(1, farthestCornerRadius(x, y, Math.max(width, viewport.width), Math.max(height, viewport.height)))
  );
  const start = devicePx(Math.max(MIN_START_RADIUS_PX, startRadiusPx));
  const startScale = Math.min(1, start / radius);
  setRevealGeometry(x, y, radius, width, height, startScale, start);
  return startScale;
}

function syncDarkSnapshotSize(): void {
  const group = getComputedStyle(document.documentElement, '::view-transition-group(theme-dark)');
  const width = parseFloat(group.width);
  const height = parseFloat(group.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const root = document.documentElement;
  root.style.setProperty('--up-reveal-w', `${devicePx(width)}px`);
  root.style.setProperty('--up-reveal-h', `${devicePx(height)}px`);
}

function clearRevealClasses(): void {
  document.documentElement.classList.remove(
    'is-theme-revealing',
    'is-theme-to-dark',
    'is-theme-to-light',
    'is-gecko-reveal'
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
  const startRadiusPx = startRadiusPxFromEvent(event);
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');
  if (isGeckoEngine()) root.classList.add('is-gecko-reveal');
  publishRevealGeometry(event, startRadiusPx);

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
    clearRevealClasses();
    cancelAnimations(animations);
    clearRevealGeometry();
    const idle = window.requestIdleCallback;
    const deferCommit =
      typeof idle === 'function'
        ? (task: () => void) => idle(task, { timeout: 250 })
        : (task: () => void) => window.setTimeout(task, 0);
    deferCommit(() => {
      runCommit();
      if (activeReveal?.finish === finish) {
        activeReveal = null;
      }
    });
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
          const startScale = publishRevealGeometry(event, startRadiusPx);
          syncDarkSnapshotSize();
          if (!groupSizeWarned) {
            const groupWidth = parseFloat(
              getComputedStyle(root, '::view-transition-group(theme-dark)').width
            );
            const bodyWidth = document.body.getBoundingClientRect().width;
            if (
              Number.isFinite(groupWidth) &&
              Math.abs(groupWidth - bodyWidth) > GROUP_SIZE_SLOP_PX
            ) {
              groupSizeWarned = true;
              console.warn(
                `[uniplan] theme reveal: ::view-transition-group(theme-dark) width ${groupWidth}px ≠ body ${bodyWidth}px`
              );
            }
          }

          const duration = goingToDark
            ? readDurationMs('--dur-scene', 620)
            : readDurationMs('--dur-emphasis', 500);
          const easeCss = readEase('--ease-reveal');
          if (root.classList.contains('is-gecko-reveal')) {
            const full = parseFloat(root.style.getPropertyValue('--up-reveal-r'));
            const start = parseFloat(root.style.getPropertyValue('--up-reveal-start'));
            const from = goingToDark ? start : full;
            const to = goingToDark ? full : start;
            const clipAnimation = root.animate(
              [
                { '--up-reveal-clip': `${from}px` },
                { '--up-reveal-clip': `${to}px` },
              ],
              {
                duration,
                easing: easeCss,
                fill: 'both',
                pseudoElement: '::view-transition-image-pair(theme-dark)',
              }
            );
            animations.push(clipAnimation);
            extendTransition(transition, clipAnimation.finished.catch(() => undefined));
            return;
          }

          const ease = unitBezier(...parseCubicBezier(easeCss));
          const { outer, inner } = bakeScaleKeyframes(startScale, ease, !goingToDark);
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
