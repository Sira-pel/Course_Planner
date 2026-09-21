export type ThemeRevealOrigin = {
  x: number;
  y: number;
};

export type ThemeRevealOptions = {
  origin: ThemeRevealOrigin;
  goingToDark: boolean;
  apply: () => void;
};

type ThemeViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
};

let activeTransition: ThemeViewTransition | null = null;
let activeAnimation: Animation | null = null;
let activeFailsafe: number | null = null;
let transitionSessionId = 0;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function farthestCornerRadius(x: number, y: number): number {
  const width = Math.max(
    window.innerWidth,
    document.documentElement.clientWidth || 0,
    window.visualViewport ? window.visualViewport.width : 0,
    typeof screen !== 'undefined' ? screen.width : 0
  );
  const height = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight || 0,
    window.visualViewport ? window.visualViewport.height : 0,
    typeof screen !== 'undefined' ? screen.height : 0
  );
  const maxDist = Math.hypot(
    Math.max(x, width - x),
    Math.max(y, height - y)
  );
  // Overshoot by 25% + 128px so all screen corners and physical display boundaries are 100% engulfed inside the circle
  // well before the animation reaches its decelerating tail, eliminating any end-of-transition stutter or edge clipping
  return Math.ceil(maxDist * 1.25 + 128);
}

function clearRevealClasses(): void {
  const root = document.documentElement;
  root.classList.remove(
    'is-theme-revealing',
    'is-theme-to-dark',
    'is-theme-to-light'
  );
  root.style.removeProperty('--theme-reveal-x');
  root.style.removeProperty('--theme-reveal-y');
}

function canStartViewTransition(
  doc: Document
): doc is Document & {
  startViewTransition: (update: () => void) => ThemeViewTransition;
} {
  return typeof doc.startViewTransition === 'function';
}

/**
 * Pointer-origin circular mask for a light/dark swap.
 * Keyboard and reduced-motion callers must skip this and just apply().
 * Supports rapid click-through by gracefully interrupting any active transition immediately.
 */
export async function runThemeReveal(options: ThemeRevealOptions): Promise<void> {
  const { origin, goingToDark, apply } = options;

  if (prefersReducedMotion() || !canStartViewTransition(document)) {
    apply();
    return;
  }

  // Rapid click-through: immediately interrupt and fast-forward any ongoing reveal
  if (activeAnimation) {
    try {
      activeAnimation.cancel();
    } catch {
      // ignore
    }
    activeAnimation = null;
  }

  if (activeTransition && typeof activeTransition.skipTransition === 'function') {
    try {
      activeTransition.skipTransition();
    } catch {
      // ignore
    }
    activeTransition = null;
  }

  if (activeFailsafe !== null) {
    window.clearTimeout(activeFailsafe);
    activeFailsafe = null;
  }

  clearRevealClasses();

  const sessionId = ++transitionSessionId;
  const root = document.documentElement;

  root.style.setProperty('--theme-reveal-x', `${origin.x}px`);
  root.style.setProperty('--theme-reveal-y', `${origin.y}px`);
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  let applied = false;
  const runApply = () => {
    if (applied) return;
    applied = true;
    apply();
  };

  const release = () => {
    if (sessionId !== transitionSessionId) return;
    if (activeFailsafe !== null) {
      window.clearTimeout(activeFailsafe);
      activeFailsafe = null;
    }
    clearRevealClasses();
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', goingToDark ? '#020617' : '#f8fafc');
    }
    activeTransition = null;
    activeAnimation = null;
  };

  // Safety failsafe in case browser aborts transition without resolving promises
  activeFailsafe = window.setTimeout(release, 1200);

  try {
    const transition = document.startViewTransition(() => {
      runApply();
    });
    activeTransition = transition;

    try {
      await transition.ready;
      if (sessionId !== transitionSessionId) return;

      const x = origin.x;
      const y = origin.y;
      const endRadius = farthestCornerRadius(x, y);
      const clip = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      // Clean, hardware-accelerated circular reveal expanding outward from click origin.
      // Easing with natural deceleration and generous overshoot ensures the final frame glides smoothly without stutter.
      const duration = 500;
      const easing = 'cubic-bezier(0.25, 1, 0.5, 1)';

      const animation = root.animate(
        { clipPath: clip },
        {
          duration,
          easing,
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      );
      activeAnimation = animation;

      // Wait until the radial clip animation has completely finished
      await animation.finished.catch(() => {});
    } catch {
      // If root.animate with pseudoElement fails (e.g. certain Safari versions) or is interrupted,
      // the view transition crossfade will still complete naturally.
    } finally {
      if (sessionId === transitionSessionId) {
        await transition.finished.catch(() => {});
        release();
      }
    }
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
