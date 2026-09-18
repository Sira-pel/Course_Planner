export type ThemeRevealOrigin = {
  x: number;
  y: number;
};

export type ThemeRevealOptions = {
  origin: ThemeRevealOrigin;
  goingToDark: boolean;
  apply: () => void;
};

const VEIL_CLASS = 'up-theme-reveal-veil';
const FAILSAFE_MS = 2000;

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

function circleClip(radiusPx: number, x: number, y: number): string {
  return `circle(${radiusPx}px at ${x}px ${y}px)`;
}

function clearRevealClasses(): void {
  document.documentElement.classList.remove(
    'is-theme-revealing',
    'is-theme-to-dark',
    'is-theme-to-light'
  );
}

function dropVeils(): void {
  document.querySelectorAll(`.${VEIL_CLASS}`).forEach((node) => node.remove());
}

function paintVeil(): HTMLElement | null {
  if (typeof document === 'undefined' || document.body == null) return null;
  dropVeils();
  const veil = document.createElement('div');
  veil.className = VEIL_CLASS;
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);
  return veil;
}

/**
 * Pointer-origin circular night for a light/dark swap.
 * Keyboard and reduced-motion callers must skip this and just apply().
 * The veil is a solid overlay, not a document snapshot.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { origin, goingToDark, apply } = options;

  if (revealBusy) {
    return;
  }

  if (prefersReducedMotion()) {
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

  const veil = paintVeil();
  if (veil == null || typeof veil.animate !== 'function') {
    runApply();
    dropVeils();
    clearRevealClasses();
    revealBusy = false;
    return;
  }

  const x = origin.x;
  const y = origin.y;
  const endRadius = farthestCornerRadius(x, y);
  const collapsed = circleClip(0, x, y);
  const covered = circleClip(endRadius, x, y);
  veil.style.clipPath = goingToDark ? collapsed : covered;
  void veil.getBoundingClientRect();

  if (!goingToDark) {
    runApply();
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    window.clearTimeout(failsafe);
    try {
      runApply();
    } finally {
      dropVeils();
      clearRevealClasses();
      revealBusy = false;
    }
  };

  const failsafe = window.setTimeout(release, FAILSAFE_MS);

  try {
    const animation = veil.animate(
      { clipPath: goingToDark ? [collapsed, covered] : [covered, collapsed] },
      {
        duration: goingToDark
          ? readDurationMs('--dur-scene', 620)
          : readDurationMs('--dur-emphasis', 500),
        easing: readEase('--ease-out'),
        fill: 'forwards',
      }
    );
    void animation.finished.then(release, release);
  } catch {
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

  const target = event.currentTarget;
  if (
    typeof target === 'object' &&
    target !== null &&
    'getBoundingClientRect' in target &&
    typeof target.getBoundingClientRect === 'function'
  ) {
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  const view = globalThis as typeof globalThis & { innerWidth?: number; innerHeight?: number };
  return { x: (view.innerWidth ?? 0) / 2, y: (view.innerHeight ?? 0) / 2 };
}

export function isPointerClick(event: { detail: number }): boolean {
  return event.detail > 0;
}
