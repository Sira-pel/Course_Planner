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
  animation: Animation | null;
  undo: () => void;
  playingForward: boolean;
  started: boolean;
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

function circleClip(radiusPx: number, x: number, y: number): string {
  return `circle(${radiusPx}px at ${x}px ${y}px)`;
}

function holeClip(radiusPx: number, x: number, y: number, width: number, height: number): string {
  const r = Math.max(1, radiusPx).toFixed(2);
  const d = (Math.max(1, radiusPx) * 2).toFixed(2);
  const cx = x.toFixed(2);
  const cy = y.toFixed(2);
  const w = width.toFixed(2);
  const h = height.toFixed(2);
  return `path(evenodd, "M0 0H${w}V${h}H0Z M${cx} ${cy}m-${r} 0a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0")`;
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

function afterPaint(fn: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
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

  const shadow = veil.attachShadow({ mode: 'open' });
  copySheets(shadow);

  const freezeRoot = document.createElement('html');
  freezeRoot.className = oldIsDark ? 'dark' : '';
  freezeRoot.style.display = 'block';
  freezeRoot.style.width = '100%';
  freezeRoot.style.height = '100%';
  freezeRoot.style.colorScheme = oldIsDark ? 'dark' : 'light';
  copyUpVars(document.documentElement, freezeRoot);

  const layoutStyle = document.createElement('style');
  layoutStyle.textContent = `
    html { display: block; width: 100%; height: 100%; }
    body { margin: 0; width: 100%; height: 100%; }
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
  freezeRoot.appendChild(layoutStyle);
  freezeRoot.appendChild(freezeBody);

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  if (oldIsDark) {
    freezeRoot.style.clipPath = circleClip(endRadius, origin.x, origin.y);
  } else {
    freezeRoot.style.clipPath = holeClip(1, origin.x, origin.y, viewW, viewH);
  }
  freezeRoot.style.willChange = 'clip-path';
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
 * Chromium animates transform / clip-path on one overlay layer.
 * A second click reverses the circle from the current radius.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { origin, goingToDark, apply } = options;

  if (prefersReducedMotion()) {
    apply();
    return;
  }

  if (activeReveal) {
    if (!activeReveal.started || activeReveal.animation == null) {
      activeReveal.playingForward = false;
      activeReveal.finish();
      return;
    }
    activeReveal.playingForward = !activeReveal.playingForward;
    flipPlayback(activeReveal.animation);
    armFailsafe(activeReveal.finish);
    return;
  }

  const root = document.documentElement;
  root.classList.add('is-theme-revealing', goingToDark ? 'is-theme-to-dark' : 'is-theme-to-light');

  const painted = paintFrozenUi(origin, !goingToDark);
  if (painted == null) {
    apply();
    dropVeils();
    clearRevealClasses();
    return;
  }

  let released = false;
  const finish = () => {
    if (released) return;
    released = true;
    window.clearTimeout(failsafe);
    const shouldUndo = activeReveal != null && !activeReveal.playingForward;
    if (shouldUndo && activeReveal.started) {
      apply();
    }
    dropVeils();
    clearRevealClasses();
    activeReveal = null;
  };

  activeReveal = { animation: null, undo: apply, playingForward: true, started: false, finish };
  armFailsafe(finish);

  afterPaint(() => {
    if (released || activeReveal == null) return;
    if (!activeReveal.playingForward) {
      finish();
      return;
    }

    apply();
    const header = document.querySelector('.up-header');
    if (header) void getComputedStyle(header).backgroundColor;

    const endRadius = Math.max(1, farthestCornerRadius(origin.x, origin.y));
    const duration = goingToDark
      ? readDurationMs('--dur-scene', 620)
      : readDurationMs('--dur-emphasis', 500);
    const easing = readEase('--ease-out');
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    try {
      const motionEl = painted.freezeRoot;
      if (typeof motionEl.animate !== 'function') {
        finish();
        return;
      }
      const animation = goingToDark
        ? motionEl.animate(
            {
              clipPath: [
                holeClip(1, origin.x, origin.y, viewW, viewH),
                holeClip(endRadius, origin.x, origin.y, viewW, viewH),
              ],
            },
            { duration, easing, fill: 'both' }
          )
        : motionEl.animate(
            {
              clipPath: [
                circleClip(endRadius, origin.x, origin.y),
                circleClip(1, origin.x, origin.y),
              ],
            },
            { duration, easing, fill: 'both' }
          );
      activeReveal.animation = animation;
      activeReveal.started = true;
      animation.addEventListener('finish', finish);
    } catch {
      finish();
    }
  });
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
