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
assert(transitionSrc.includes('::view-transition-old(root)'), 'dark-to-light clips the old root snapshot');
assert(transitionSrc.includes('::view-transition-new(root)'), 'light-to-dark clips the new root snapshot');
assert(transitionSrc.includes('pseudoElement'), 'theme reveal animates view-transition pseudos');
assert(transitionSrc.includes('visualViewport'), 'circle radius uses visualViewport');
assert(transitionSrc.includes('circle('), 'reveal uses compositable circle() clip');
assert(transitionSrc.includes('readEase'), 'reveal easing comes from --ease-out');
assert(transitionSrc.includes('--dur-scene'), 'to-dark uses scene duration');
assert(transitionSrc.includes('--dur-emphasis'), 'to-light uses emphasis duration');
assert(transitionSrc.includes('skipTransition'), 'in-flight toggle jumps to finished');
assert(transitionSrc.includes('requestAnimationFrame'), 'flatten paints one frame before capture');
assert(!transitionSrc.includes('mask-image'), 'theme reveal does not animate mask-image');
assert(!transitionSrc.includes('--up-reveal-r'), 'theme reveal does not animate a mask radius variable');
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

const busyStart = transitionSrc.indexOf('if (activeReveal)');
const busyEnd = transitionSrc.indexOf('const origin = originFromPointer');
const busyBlock = busyStart >= 0 && busyEnd > busyStart ? transitionSrc.slice(busyStart, busyEnd) : '';
assert(busyBlock.includes('skipTransition'), 'busy click skips the in-flight transition');
assert(!busyBlock.includes('apply()'), 'busy click does not start a second apply');

const css = readFileSync(join(here, '../index.css'), 'utf8');
assert(!css.includes('html.is-theme-revealing *'), 'no universal revealing selector');
assert(css.includes('html.is-theme-revealing::view-transition-old(root)'), 'default VT fade is disabled');
assert(css.includes('html.is-theme-revealing::view-transition-new(root)'), 'new snapshot fade is disabled');
assert(css.includes('html.is-theme-revealing::view-transition-image-pair(root)'), 'image pair isolation is restored');
assert(css.includes('html.is-theme-to-dark::view-transition-new(root)'), 'to-dark raises the incoming snapshot');
assert(css.includes('html.is-theme-to-light::view-transition-old(root)'), 'to-light keeps the outgoing snapshot on top');
assert(!css.includes('.up-theme-reveal-veil'), 'overlay class is gone');
assert(!css.includes('mask-image'), 'page CSS does not mask the freeze overlay');
assert(!css.includes('.up-theme-reveal-disk'), 'solid night disk is gone');
assert(!css.includes('html.is-theme-revealing #root'), 'live #root is not restacked for a freeze');
assert(!css.includes('html.is-theme-to-dark #root'), 'live #root is not raised over a freeze');
assert(
  (css.match(/--up-raised:/g) || []).length === 2,
  'header and pool inherit --up-raised from html instead of restating it'
);
assert(css.includes('html.is-theme-revealing .sticky'), 'sticky day headers flatten before capture');
assert(css.includes('html.is-theme-revealing .backdrop-blur-xs'), 'blur layers flatten before capture');
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
