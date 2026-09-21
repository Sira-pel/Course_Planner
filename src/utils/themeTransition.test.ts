import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPointerClick, originFromPointer, originRelativeTo } from './themeTransition';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isPointerClick({ detail: 1 }) === true, 'mouse click is a pointer click');
assert(isPointerClick({ detail: 2 }) === true, 'double-click is a pointer click');
assert(isPointerClick({ detail: 0 }) === false, 'keyboard activation is not a pointer click');

const fromClient = originFromPointer({
  clientX: 24,
  clientY: 80,
  currentTarget: null,
});
assert(fromClient.x === 24 && fromClient.y === 80, 'client point is used when there is no target box');

const fromBox = originFromPointer({
  clientX: 24,
  clientY: 80,
  currentTarget: {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 40, height: 30 }),
  } as unknown as EventTarget,
});
assert(fromBox.x === 30 && fromBox.y === 35, 'toggle box center wins over the raw click point');

const fromOverlay = originRelativeTo(
  { getBoundingClientRect: () => ({ left: 80, top: 10, width: 400, height: 609 }) },
  {
    clientX: 0,
    clientY: 0,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 340, top: 20, width: 40, height: 40 }),
    } as unknown as EventTarget,
  }
);
assert(fromOverlay.x === 280 && fromOverlay.y === 30, 'origin is relative to the overlay frame, not the page');

Object.defineProperty(globalThis, 'innerWidth', { value: 1000, configurable: true });
Object.defineProperty(globalThis, 'innerHeight', { value: 800, configurable: true });
const fromViewport = originFromPointer({
  clientX: 0,
  clientY: 0,
  currentTarget: null,
});
assert(fromViewport.x === 500 && fromViewport.y === 400, 'no target falls back to viewport center');

Object.defineProperty(globalThis, 'visualViewport', {
  value: { width: 400, height: 609, offsetLeft: 10, offsetTop: 20 },
  configurable: true,
});
const fromVisual = originFromPointer({
  clientX: 50,
  clientY: 80,
  currentTarget: null,
});
assert(fromVisual.x === 40 && fromVisual.y === 60, 'origin is relative to visualViewport offset');

const here = dirname(fileURLToPath(import.meta.url));
const transitionSrc = readFileSync(join(here, 'themeTransition.ts'), 'utf8');
assert(transitionSrc.includes('startViewTransition'), 'theme reveal captures both themes with View Transitions');
assert(transitionSrc.includes("pseudoElement: '::view-transition-image-pair(theme-dark)'"), 'outer scale targets the theme-dark image pair');
assert(transitionSrc.includes("pseudoElement: goingToDark"), 'inner inverse-scale picks old vs new by direction');
assert(transitionSrc.includes('::view-transition-new(theme-dark)'), 'to-dark inverse-scales the new dark snapshot');
assert(transitionSrc.includes('::view-transition-old(theme-dark)'), 'to-light inverse-scales the old dark snapshot');
assert(transitionSrc.includes("easing: 'linear'"), 'baked scale keyframes use linear segment easing');
assert(transitionSrc.includes('KEYFRAME_COUNT = 60'), 'ease-out is sampled across ~60 keyframes');
assert(transitionSrc.includes('document.body'), 'origin and radius are measured from body');
assert(transitionSrc.includes('visualViewport'), 'radius uses visualViewport as a max() cover guard');
assert(transitionSrc.includes('--up-reveal-x'), 'origin x is published as a CSS var');
assert(transitionSrc.includes('--up-reveal-y'), 'origin y is published as a CSS var');
assert(transitionSrc.includes('--up-reveal-r'), 'circle radius is published as a CSS var');
assert(transitionSrc.includes('--up-reveal-w'), 'snapshot width is published as a CSS var');
assert(transitionSrc.includes('--up-reveal-h'), 'snapshot height is published as a CSS var');
assert(transitionSrc.includes('--up-reveal-s0'), 'start scale is published as a CSS var');
assert(transitionSrc.includes('readEase'), 'reveal easing comes from --ease-out');
assert(transitionSrc.includes('--dur-scene'), 'to-dark uses scene duration');
assert(transitionSrc.includes('--dur-emphasis'), 'to-light uses emphasis duration');
assert(transitionSrc.includes('skipTransition'), 'in-flight toggle jumps to finished');
assert(transitionSrc.includes('requestAnimationFrame'), 'flatten paints one frame before capture');
assert(transitionSrc.includes('animation.cancel()'), 'fill:both animations are cancelled on finish');
assert(!transitionSrc.includes('clipPath'), 'theme reveal does not animate clipPath');
assert(!transitionSrc.includes('circle('), 'JS does not use clip-path: circle()');
assert(!transitionSrc.includes('mask-image'), 'theme reveal does not animate mask-image');
assert(!transitionSrc.includes('evenodd'), 'light-to-dark does not punch an evenodd path hole');
assert(!transitionSrc.includes('diskClip'), 'path disks are gone');
assert(!transitionSrc.includes('holeClip'), 'path holes are gone');
assert(!transitionSrc.includes('cloneNode'), 'theme reveal does not clone the live tree');
assert(!transitionSrc.includes('attachShadow'), 'theme reveal does not freeze UI in a shadow tree');
assert(!transitionSrc.includes('paintFrozenUi'), 'clone freeze helper is gone');
assert(!transitionSrc.includes('up-theme-reveal-veil'), 'theme reveal does not paint a dedicated overlay');
assert(!transitionSrc.includes('isPhoneViewport'), 'phone viewports no longer skip the circular reveal');
assert(!transitionSrc.includes('PHONE_MAX_PX'), 'phone skip breakpoint is gone');
assert(!transitionSrc.includes('goingToDark ? painted.app'), 'light-to-dark does not clip live #root');
assert(!transitionSrc.includes("getElementById('root')"), 'live #root is not a clip target');
assert(!transitionSrc.includes('willChange'), 'will-change is not set on the live tree');
assert(!transitionSrc.includes('flipPlayback'), 'VT snapshots are not reversed with playbackRate');
assert(!transitionSrc.includes('updatePlaybackRate'), 'VT snapshots are not reversed with playbackRate');
assert(transitionSrc.includes('.then(finish, finish)'), 'finished both settles into cleanup');

const captureCall = transitionSrc.indexOf('document.startViewTransition');
assert(captureCall >= 0, 'capture call exists');
const beforeCapture = transitionSrc.slice(0, captureCall);
assert(beforeCapture.includes('publishRevealGeometry'), 'geometry is published before startViewTransition');
assert(
  beforeCapture.includes("root.classList.add('is-theme-revealing'"),
  'revealing class is on before capture'
);
const readyStart = transitionSrc.indexOf('transition.ready');
const readyEnd = transitionSrc.indexOf('transition.finished');
const readyBlock =
  readyStart >= 0 && readyEnd > readyStart ? transitionSrc.slice(readyStart, readyEnd) : '';
assert(readyBlock.includes('publishRevealGeometry'), 'geometry is refreshed on transition.ready');

const finishStart = transitionSrc.indexOf('const finish = () =>');
const finishEnd = transitionSrc.indexOf('activeReveal = {');
const finishBlock =
  finishStart >= 0 && finishEnd > finishStart ? transitionSrc.slice(finishStart, finishEnd) : '';
const classClearIdx = finishBlock.indexOf('clearRevealClasses()');
const cancelIdx = finishBlock.indexOf('cancelAnimations(');
const geometryClearIdx = finishBlock.indexOf('clearRevealGeometry()');
assert(classClearIdx >= 0, 'finish() clears reveal classes');
assert(cancelIdx > classClearIdx, 'finish() removes classes before cancelling fill:both animations');
assert(
  geometryClearIdx > cancelIdx,
  'finish() clears geometry after cancelling fill:both animations'
);

const busyStart = transitionSrc.indexOf('if (activeReveal)');
const busyEnd = transitionSrc.indexOf("root.classList.add('is-theme-revealing'");
const busyBlock = busyStart >= 0 && busyEnd > busyStart ? transitionSrc.slice(busyStart, busyEnd) : '';
assert(busyBlock.includes('skipTransition'), 'busy click skips the in-flight transition');
assert(!busyBlock.includes('apply()'), 'busy click does not start a second apply');

const css = readFileSync(join(here, '../index.css'), 'utf8');
assert(!css.includes('html.is-theme-revealing *'), 'no universal revealing selector');
assert(css.includes('view-transition-name: theme-light'), 'light body snapshot is named theme-light');
assert(css.includes('view-transition-name: theme-dark'), 'dark body snapshot is named theme-dark');
assert(css.includes('html.is-theme-revealing::view-transition-group(root)'), 'root group animations are silenced');
assert(css.includes('html.is-theme-revealing::view-transition-image-pair(theme-dark)'), 'theme-dark image pair is the circle wrapper');
assert(css.includes('border-radius: 50%'), 'circle wrapper uses a round clip');
assert(css.includes('overflow: clip'), 'circle wrapper clips with overflow: clip');
assert(css.includes('overflow: hidden'), 'circle wrapper also uses overflow: hidden');
assert(css.includes('clip-path: circle(50%)'), 'wrapper uses a static circular clip');
assert(css.includes('html.is-theme-revealing::view-transition-group(theme-light)'), 'light group sits under the circle');
assert(css.includes('z-index: 1'), 'theme-light stays underneath');
assert(css.includes('z-index: 2'), 'theme-dark circle stays on top');
assert(!css.includes('clip-path: circle(var'), 'page CSS does not animate clip-path radius');

const revealCssStart = css.indexOf('/* Theme reveal:');
const revealCssEnd = css.indexOf('@media (prefers-reduced-motion: reduce)');
const revealCss =
  revealCssStart >= 0 && revealCssEnd > revealCssStart ? css.slice(revealCssStart, revealCssEnd) : '';
assert(revealCss.includes('animation: none !important'), 'revealing VT rules beat Firefox UA fades');
assert(
  revealCss.includes('html.is-theme-revealing::view-transition-group(root)') &&
    revealCss.includes('html.is-theme-revealing::view-transition-image-pair(root)') &&
    revealCss.includes('html.is-theme-revealing::view-transition-old(root)') &&
    revealCss.includes('html.is-theme-revealing::view-transition-new(root)'),
  'root VT pseudos are silenced'
);
assert(
  revealCss.includes('html.is-theme-revealing::view-transition-group(theme-light)') &&
    revealCss.includes('html.is-theme-revealing::view-transition-group(theme-dark)'),
  'theme groups are silenced'
);
assert(revealCss.includes('transform: none'), 'theme groups pin transform none');
assert(
  /::view-transition-group\(theme-light\),\s*html\.is-theme-revealing::view-transition-group\(theme-dark\) \{[^}]*width: 100%;[^}]*height: 100%;[^}]*transform: none;/s.test(
    revealCss
  ),
  'theme groups are full-size with inset and no morph'
);
assert(
  revealCss.includes('html.is-theme-to-dark::view-transition-image-pair(theme-dark)'),
  'to-dark first paint scales the circle wrapper'
);
assert(revealCss.includes('scale(var(--up-reveal-s0))'), 'to-dark wrapper starts at s0');
assert(
  revealCss.includes('html.is-theme-to-dark::view-transition-new(theme-dark)'),
  'to-dark first paint inverse-scales the new snapshot'
);
assert(revealCss.includes('scale(calc(1 / var(--up-reveal-s0)))'), 'to-dark snapshot starts at 1/s0');
assert(
  revealCss.includes('html.is-theme-to-light::view-transition-image-pair(theme-dark)'),
  'to-light first paint keeps the wrapper at scale 1'
);
assert(!css.includes('.up-theme-reveal-veil'), 'overlay class is gone');
assert(!css.includes('mask-image'), 'page CSS does not mask the freeze overlay');
assert(!css.includes('.up-theme-reveal-disk'), 'solid night disk is gone');
assert(!css.includes('html.is-theme-revealing #root'), 'live #root is not restacked for a freeze');
assert(!css.includes('html.is-theme-to-dark #root'), 'live #root is not raised over a freeze');
assert(
  (css.match(/--up-raised:/g) || []).length === 2,
  'header and pool inherit --up-raised from html instead of restating it'
);
assert(!css.includes('html.is-theme-revealing .sticky'), 'sticky flattening is not needed for named body capture');
assert(!css.includes('html.is-theme-revealing .backdrop-blur-xs'), 'backdrop flattening is not needed for named body capture');
assert(css.includes('html.is-theme-revealing .up-header'), 'header bar skips color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-pool-rail'), 'pool rail skips color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-app'), 'app shell skips color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-chrome-btn'), 'chrome buttons skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-pool-tab'), 'pool tabs skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-pool-row'), 'pool rows skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .transition-colors'), 'transition-colors skip during reveal');
assert(css.includes('html.is-theme-revealing .transition-all'), 'transition-all skip during reveal');
assert(css.includes('html.is-theme-revealing .transition-opacity'), 'transition-opacity skip during reveal');
assert(css.includes('transition: none !important'), 'reveal kills transitions with none, not 0s');
assert(css.includes('html.dark .up-theme-glyph .up-theme-moon'), 'glyph follows html.dark, not React data-mode');
assert(css.includes('html:not(.dark) .up-theme-glyph .up-theme-sun'), 'light glyph follows html without .dark');

const prefsSrc = readFileSync(join(here, '../store/prefsSlice.ts'), 'utf8');
const setThemeStart = prefsSrc.indexOf('setTheme:');
const commitStart = prefsSrc.indexOf('commitTheme:');
const toggleStart = prefsSrc.indexOf('toggleTheme:');
assert(setThemeStart >= 0 && commitStart > setThemeStart && toggleStart > commitStart, 'paint and commit are split');
const setThemeBlock = prefsSrc.slice(setThemeStart, commitStart);
const commitBlock = prefsSrc.slice(commitStart, toggleStart);
assert(setThemeBlock.includes('applyDomTheme'), 'instant setTheme still paints html.dark');
assert(setThemeBlock.includes('persistTheme'), 'instant setTheme still writes uniplan_theme');
assert(setThemeBlock.includes('set({ theme })'), 'instant setTheme still commits the store');
assert(!commitBlock.includes('applyDomTheme'), 'commitTheme does not paint mid-circle');
assert(!commitBlock.includes('persistTheme'), 'commitTheme does not rewrite uniplan_theme');
assert(commitBlock.includes('set({ theme })'), 'commitTheme only writes Zustand after the reveal');

console.log('themeTransition tests passed');
