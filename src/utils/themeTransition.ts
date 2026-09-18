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
const SHOT_CLASS = 'up-theme-reveal-shot';
const FAILSAFE_MS = 2000;
const UP_VARS = [
  '--up-raised',
  '--up-ink',
  '--up-muted',
  '--up-line',
  '--up-accent',
  '--up-accent-ink',
  '--up-focus',
] as const;

type ActiveReveal = {
  animation: Animation;
  undo: () => void;
  playingForward: boolean;
  finish: () => void;
};

let activeReveal: ActiveReveal | null = null;
let failsafe = 0;

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

function dropVeils(): void {
  document.querySelectorAll(`.${VEIL_CLASS}`).forEach((node) => {
    if (node instanceof HTMLElement && 'hidePopover' in node && typeof node.hidePopover === 'function') {
      try {
        node.hidePopover();
      } catch {
        // Already closed or not a popover.
      }
    }
    node.remove();
  });
}

const FREEZE_FLATTEN_CSS = `
  html, html * {
    z-index: 0 !important;
    isolation: auto !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
  }
  .sticky {
    position: relative !important;
    top: 0 !important;
  }
`;

function copySheets(shadow: ShadowRoot): void {
  try {
    const flatten = new CSSStyleSheet();
    flatten.replaceSync(FREEZE_FLATTEN_CSS);
    const base = document.adoptedStyleSheets.length > 0 ? [...document.adoptedStyleSheets] : [];
    shadow.adoptedStyleSheets = [...base, flatten];
  } catch {
    if (document.adoptedStyleSheets.length > 0) {
      try {
        shadow.adoptedStyleSheets = [...document.adoptedStyleSheets];
      } catch {
        // Constructed sheets are not always shareable.
      }
    }
  }
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    shadow.appendChild(node.cloneNode(true));
  });
  const extra = document.createElement('style');
  extra.textContent = FREEZE_FLATTEN_CSS;
  shadow.appendChild(extra);
}

function copyUpVars(from: Element, to: HTMLElement): void {
  const styles = getComputedStyle(from);
  for (const name of UP_VARS) {
    to.style.setProperty(name, styles.getPropertyValue(name));
  }
}

function copyScroll(from: Element, to: Element): void {
  if (from.scrollTop !== 0 || from.scrollLeft !== 0) {
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
  }
  const fromKids = from.children;
  const toKids = to.children;
  const n = Math.min(fromKids.length, toKids.length);
  for (let i = 0; i < n; i += 1) {
    copyScroll(fromKids[i], toKids[i]);
  }
}

function flipPlayback(animation: Animation): void {
  if (animation.playState === 'paused' || animation.playState === 'idle') {
    animation.play();
  }
  const rate = animation.playbackRate === 0 ? 1 : animation.playbackRate;
  if (typeof animation.updatePlaybackRate === 'function') {
    animation.updatePlaybackRate(-rate);
    return;
  }
  animation.playbackRate = -rate;
}

function armFailsafe(finish: () => void): void {
  window.clearTimeout(failsafe);
  failsafe = window.setTimeout(finish, FAILSAFE_MS);
}

function paintFrozenUi(
  origin: ThemeRevealOrigin,
  oldIsDark: boolean
): { veil: HTMLElement; freezeRoot: HTMLElement } | null {
  const app = document.getElementById('root');
  if (app == null || document.body == null) return null;

  dropVeils();

  const endRadius = Math.max(1, farthestCornerRadius(origin.x, origin.y));
  const veil = document.createElement('div');
  veil.className = `${VEIL_CLASS} ${oldIsDark ? 'is-theme-to-light' : 'is-theme-to-dark'}`;
  veil.setAttribute('aria-hidden', 'true');
  veil.style.setProperty('--up-reveal-cx', `${origin.x}px`);
  veil.style.setProperty('--up-reveal-cy', `${origin.y}px`);
  veil.style.setProperty('--up-reveal-r', oldIsDark ? `${endRadius}px` : '1px');

  const shadow = veil.attachShadow({ mode: 'open' });
  copySheets(shadow);

  const freezeRoot = document.createElement('html');
  freezeRoot.className = oldIsDark ? 'dark is-theme-to-light' : 'is-theme-to-dark';
  freezeRoot.style.display = 'block';
  freezeRoot.style.width = '100%';
  freezeRoot.style.height = '100%';
  freezeRoot.style.colorScheme = oldIsDark ? 'dark' : 'light';
  copyUpVars(document.documentElement, freezeRoot);
  freezeRoot.style.setProperty('--up-reveal-cx', `${origin.x}px`);
  freezeRoot.style.setProperty('--up-reveal-cy', `${origin.y}px`);
  freezeRoot.style.setProperty('--up-reveal-r', oldIsDark ? `${endRadius}px` : '1px');

  const maskStyle = document.createElement('style');
  maskStyle.textContent = `
    html {
      display: block;
      width: 100%;
      height: 100%;
    }
    html, html * {
      z-index: 0 !important;
      isolation: auto !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      filter: none !important;
    }
    .sticky {
      position: relative !important;
      top: 0 !important;
    }
    html.is-theme-to-dark {
      mask-image: radial-gradient(circle at var(--up-reveal-cx) var(--up-reveal-cy), transparent var(--up-reveal-r), #000 var(--up-reveal-r));
      -webkit-mask-image: radial-gradient(circle at var(--up-reveal-cx) var(--up-reveal-cy), transparent var(--up-reveal-r), #000 var(--up-reveal-r));
    }
    html.is-theme-to-light {
      mask-image: radial-gradient(circle at var(--up-reveal-cx) var(--up-reveal-cy), #000 var(--up-reveal-r), transparent var(--up-reveal-r));
      -webkit-mask-image: radial-gradient(circle at var(--up-reveal-cx) var(--up-reveal-cy), #000 var(--up-reveal-r), transparent var(--up-reveal-r));
    }
    body {
      margin: 0;
      width: 100%;
      height: 100%;
    }
  `;

  const freezeBody = document.createElement('body');
  freezeBody.className = document.body.className;
  freezeBody.style.margin = '0';
  freezeBody.style.width = '100%';
  freezeBody.style.height = '100%';

  const shot = app.cloneNode(true) as HTMLElement;
  shot.removeAttribute('id');
  shot.classList.add(SHOT_CLASS);
  shot.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  const rect = app.getBoundingClientRect();
  shot.style.position = 'absolute';
  shot.style.left = `${rect.left}px`;
  shot.style.top = `${rect.top}px`;
  shot.style.width = `${rect.width}px`;
  shot.style.height = `${rect.height}px`;
  shot.style.margin = '0';
  shot.style.overflow = 'hidden';

  freezeBody.appendChild(shot);
  freezeRoot.appendChild(maskStyle);
  freezeRoot.appendChild(freezeBody);
  shadow.appendChild(freezeRoot);
  veil.setAttribute('popover', 'manual');
  veil.setAttribute('inert', '');
  document.body.appendChild(veil);
  if ('showPopover' in veil && typeof veil.showPopover === 'function') {
    try {
      veil.showPopover();
    } catch {
      // Unsupported or already open; fixed positioning still applies.
    }
  }
  copyScroll(app, shot);
  return { veil, freezeRoot };
}

/**
 * Pointer-origin circular swap that keeps both UIs on screen.
 * A second click reverses the in-flight circle instead of queuing a new reveal.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { origin, goingToDark, apply } = options;

  if (prefersReducedMotion()) {
    apply();
    return;
  }

  if (activeReveal) {
    // Only turn the circle around from here. Do not restyle the live tree yet.
    activeReveal.playingForward = !activeReveal.playingForward;
    flipPlayback(activeReveal.animation);
    armFailsafe(activeReveal.finish);
    return;
  }

  const root = document.documentElement;
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  const painted = paintFrozenUi(origin, !goingToDark);
  if (painted == null || typeof painted.freezeRoot.animate !== 'function') {
    apply();
    dropVeils();
    clearRevealClasses();
    return;
  }

  void painted.freezeRoot.getBoundingClientRect();
  apply();
  const header = document.querySelector('.up-header');
  if (header) void getComputedStyle(header).backgroundColor;

  let released = false;
  const finish = () => {
    if (released) return;
    released = true;
    window.clearTimeout(failsafe);
    const shouldUndo = activeReveal != null && !activeReveal.playingForward;
    if (shouldUndo) {
      apply();
    }
    dropVeils();
    clearRevealClasses();
    activeReveal = null;
  };

  const endRadius = Math.max(1, farthestCornerRadius(origin.x, origin.y));
  const startR = goingToDark ? '1px' : `${endRadius}px`;
  const endR = goingToDark ? `${endRadius}px` : '1px';

  try {
    const animation = painted.freezeRoot.animate(
      [{ ['--up-reveal-r']: startR }, { ['--up-reveal-r']: endR }],
      {
        duration: goingToDark
          ? readDurationMs('--dur-scene', 620)
          : readDurationMs('--dur-emphasis', 500),
        easing: readEase('--ease-out'),
        fill: 'both',
      }
    );
    activeReveal = { animation, undo: apply, playingForward: true, finish };
    armFailsafe(finish);
    animation.addEventListener('finish', finish);
  } catch {
    finish();
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
