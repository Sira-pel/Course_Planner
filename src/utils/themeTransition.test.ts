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

const here = dirname(fileURLToPath(import.meta.url));
const transitionSrc = readFileSync(join(here, 'themeTransition.ts'), 'utf8');
assert(!transitionSrc.includes('startViewTransition'), 'theme reveal does not use View Transitions');
assert(!transitionSrc.includes('::view-transition-old'), 'theme reveal does not clip the old root snapshot');
assert(!transitionSrc.includes('::view-transition-new'), 'theme reveal does not clip the new root snapshot');
assert(!transitionSrc.includes('pseudoElement'), 'theme reveal does not animate view-transition pseudos');
assert(!transitionSrc.includes('mask-image'), 'theme reveal does not animate mask-image');
assert(!transitionSrc.includes('--up-reveal-r'), 'theme reveal does not animate a mask radius variable');
assert(transitionSrc.includes('clipPath') || transitionSrc.includes('clip-path'), 'the freeze layer is clipped, not masked');
assert(transitionSrc.includes('evenodd'), 'light-to-dark opens a hole with an evenodd clip');
assert(transitionSrc.includes('originRelativeTo'), 'circle origin is measured against the overlay frame');
assert(transitionSrc.includes('diskClip'), 'dark-to-light clips a path disk with a locked center');
assert(!transitionSrc.includes('circle('), 'Chromium circle() clip origin is not used');
assert(transitionSrc.includes('cloneNode'), 'theme reveal freezes the outgoing UI');
assert(transitionSrc.includes('attachShadow'), 'frozen UI is isolated from html.dark');
assert(transitionSrc.includes('up-theme-reveal-veil'), 'theme reveal paints a dedicated overlay');
assert(transitionSrc.includes('updatePlaybackRate'), 'in-flight toggle reverses playback from the current time');
assert(!transitionSrc.includes('.then(finish, finish)'), 'reverse must not treat a rejected finished promise as done');
assert(transitionSrc.includes('playingForward'), 'reverse keeps the freeze until the circle returns');
assert(transitionSrc.includes('isPhoneViewport'), 'phone viewports skip the circular reveal');
assert(transitionSrc.includes('PHONE_MAX_PX'), 'phone skip uses the 639px layout breakpoint');
const busyStart = transitionSrc.indexOf('if (activeReveal)');
const busyEnd = transitionSrc.indexOf('const root = document.documentElement');
const busyBlock = busyStart >= 0 && busyEnd > busyStart ? transitionSrc.slice(busyStart, busyEnd) : '';
assert(busyBlock.includes('flipPlayback'), 'busy click flips the in-flight circle');
assert(!busyBlock.includes('apply()'), 'busy click does not snap the live theme');
assert(transitionSrc.includes("createElement('html')"), 'freeze layer is a document-shaped shadow');
assert(transitionSrc.includes('#btn-add-course'), 'phone freeze keeps add-course hidden by id');
assert(transitionSrc.includes('#btn-undo'), 'phone freeze keeps undo hidden by id');
assert(transitionSrc.includes('.up-fab-cluster'), 'phone freeze keeps the dock in the circle');
assert(transitionSrc.includes('0.4, 0, 0.2, 1'), 'reveal easing is not a snap ease-out');
assert(!transitionSrc.includes("removeAttribute('id')"), 'clone keeps ids so phone header CSS still matches');
assert(transitionSrc.includes('backdrop-filter: none !important'), 'freeze layer drops backdrop-filter so Firefox masks sticky chrome');

const css = readFileSync(join(here, '../index.css'), 'utf8');
assert(!css.includes('html.is-theme-revealing *'), 'no universal revealing selector');
assert(!css.includes('html.is-theme-revealing::view-transition'), 'no root view-transition reveal rules');
assert(css.includes('.up-theme-reveal-veil'), 'overlay class is present');
assert(!css.includes('mask-image'), 'page CSS does not mask the freeze overlay');
assert(!css.includes('.up-theme-reveal-disk'), 'solid night disk is gone');
assert(css.includes('html.is-theme-revealing #root'), 'app stacking stays under the overlay during reveal');
assert(
  (css.match(/--up-raised:/g) || []).length === 2,
  'header and pool inherit --up-raised from html instead of restating it'
);
assert(css.includes('html.is-theme-revealing .sticky'), 'live sticky day headers stay under the overlay');
assert(css.includes('html.is-theme-revealing .backdrop-blur-xs'), 'live blur layers stay under the overlay');
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

console.log('themeTransition tests passed');
