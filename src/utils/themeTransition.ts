import { PHONE_MAX_PX } from './layoutBreakpoint';

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

function isPhoneViewport(): boolean {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(`(max-width: ${PHONE_MAX_PX}px)`).matches;
  }
  return viewMetrics().width <= PHONE_MAX_PX;
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

function viewMetrics(): { width: number; height: number } {
  const g = globalThis as typeof globalThis & {
    visualViewport?: { width: number; height: number };
    innerWidth?: number;
    innerHeight?: number;
  };
  const vv = g.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height };
  }
  return { width: g.innerWidth ?? 0, height: g.innerHeight ?? 0 };
}

function farthestCornerRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

function arcPair(radiusPx: number, x: number, y: number): { r: string; d: string; cx: string; cy: string } {
  const radius = Math.max(1, radiusPx);
  return {
    r: radius.toFixed(2),
    d: (radius * 2).toFixed(2),
    cx: x.toFixed(2),
    cy: y.toFixed(2),
  };
}

function diskClip(radiusPx: number, x: number, y: number): string {
  const { r, d, cx, cy } = arcPair(radiusPx, x, y);
  return `path("M${cx} ${cy}m-${r} 0a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0")`;
}

function holeClip(radiusPx: number, x: number, y: number, width: number, height: number): string {
  const { r, d, cx, cy } = arcPair(radiusPx, x, y);
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

const FREEZE_PHONE_CSS = `
  #btn-add-course,
  #btn-undo,
  #btn-redo {
    display: none !important;
  }
  .up-fab-cluster {
    display: flex !important;
  }
  .up-footer {
    display: none !important;
  }
`;

const REVEAL_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function copySheets(shadow: ShadowRoot, phoneLayout: boolean): void {
  const freezeCss = FREEZE_FLATTEN_CSS + (phoneLayout ? FREEZE_PHONE_CSS : '');
  try {
    const flatten = new CSSStyleSheet();
    flatten.replaceSync(freezeCss);
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
  extra.textContent = freezeCss;
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
  oldIsDark: boolean
): { veil: HTMLElement; freezeRoot: HTMLElement; viewW: number; viewH: number } | null {
  const app = document.getElementById('root');
  if (app == null || document.body == null) return null;

  dropVeils();

  const frame = document.documentElement.getBoundingClientRect();
  const viewW = frame.width || viewMetrics().width;
  const viewH = frame.height || viewMetrics().height;
  const veil = document.createElement('div');
  veil.className = `${VEIL_CLASS} ${oldIsDark ? 'is-theme-to-light' : 'is-theme-to-dark'}`;
  veil.setAttribute('aria-hidden', 'true');
  veil.style.inset = 'auto';
  veil.style.left = `${frame.left}px`;
  veil.style.top = `${frame.top}px`;
  veil.style.width = `${viewW}px`;
  veil.style.height = `${viewH}px`;
  veil.style.margin = '0';
  veil.style.maxWidth = 'none';
  veil.style.maxHeight = 'none';

  const shadow = veil.attachShadow({ mode: 'open' });
  copySheets(shadow, viewW < 640);

  const freezeRoot = document.createElement('html');
  freezeRoot.className = oldIsDark ? 'dark' : '';
  freezeRoot.style.display = 'block';
  freezeRoot.style.width = `${viewW}px`;
  freezeRoot.style.height = `${viewH}px`;
  freezeRoot.style.colorScheme = oldIsDark ? 'dark' : 'light';
  copyUpVars(document.documentElement, freezeRoot);

  const layoutStyle = document.createElement('style');
  layoutStyle.textContent = `
    html { display: block; width: ${viewW}px; height: ${viewH}px; }
    body { margin: 0; width: ${viewW}px; height: ${viewH}px; }
  `;

  const freezeBody = document.createElement('body');
  freezeBody.className = document.body.className;
  freezeBody.style.margin = '0';
  freezeBody.style.width = `${viewW}px`;
  freezeBody.style.height = `${viewH}px`;
  const appSurface = document.querySelector('.up-app');
  freezeBody.style.background =
    (appSurface ? getComputedStyle(appSurface).backgroundColor : '') ||
    getComputedStyle(document.body).backgroundColor;

  const shot = app.cloneNode(true) as HTMLElement;
  shot.classList.add(SHOT_CLASS);
  const rect = app.getBoundingClientRect();
  shot.style.position = 'absolute';
  shot.style.left = `${rect.left - frame.left}px`;
  shot.style.top = `${rect.top - frame.top}px`;
  shot.style.width = `${rect.width}px`;
  shot.style.height = `${rect.height}px`;
  shot.style.margin = '0';
  shot.style.overflow = 'hidden';

  freezeBody.appendChild(shot);
  freezeRoot.appendChild(layoutStyle);
  freezeRoot.appendChild(freezeBody);
  freezeRoot.style.willChange = 'clip-path';
  shadow.appendChild(freezeRoot);
  document.body.appendChild(veil);
  copyScroll(app, shot);
  return { veil, freezeRoot, viewW, viewH };
}

/**
 * Pointer-origin circular swap that keeps both UIs on screen.
 * Chromium animates transform / clip-path on one overlay layer.
 * A second click reverses the circle from the current radius.
 */
export function runThemeReveal(options: ThemeRevealOptions): void {
  const { event, goingToDark, apply } = options;

  if (prefersReducedMotion() || isPhoneViewport()) {
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

  const painted = paintFrozenUi(!goingToDark);
  if (painted == null) {
    apply();
    dropVeils();
    clearRevealClasses();
    return;
  }

  const origin = originRelativeTo(painted.veil, event);
  const endRadius = Math.max(1, farthestCornerRadius(origin.x, origin.y, painted.viewW, painted.viewH));
  if (goingToDark) {
    painted.freezeRoot.style.clipPath = holeClip(1, origin.x, origin.y, painted.viewW, painted.viewH);
  } else {
    painted.freezeRoot.style.clipPath = diskClip(endRadius, origin.x, origin.y);
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

    const duration = goingToDark
      ? readDurationMs('--dur-scene', 620)
      : readDurationMs('--dur-scene', 620);
    const easing = REVEAL_EASE;
    const viewW = painted.viewW;
    const viewH = painted.viewH;

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
                diskClip(endRadius, origin.x, origin.y),
                diskClip(1, origin.x, origin.y),
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
  const { width, height } = viewMetrics();
  return originRelativeTo(
    { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) },
    event
  );
}

export function isPointerClick(event: { detail: number }): boolean {
  return event.detail > 0;
}
