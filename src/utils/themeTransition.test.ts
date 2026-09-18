import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPointerClick, originFromPointer } from './themeTransition';

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
assert(fromClient.x === 24 && fromClient.y === 80, 'non-zero client point wins');

const fromBox = originFromPointer({
  clientX: 0,
  clientY: 0,
  currentTarget: {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 40, height: 30 }),
  } as unknown as EventTarget,
});
assert(fromBox.x === 30 && fromBox.y === 35, 'zero client point uses target box center');

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
assert(!transitionSrc.includes('clipPath'), 'theme reveal does not clip-path the overlay');
assert(transitionSrc.includes('cloneNode'), 'theme reveal freezes the outgoing UI');
assert(transitionSrc.includes('attachShadow'), 'frozen UI is isolated from html.dark');
assert(transitionSrc.includes('up-theme-reveal-veil'), 'theme reveal paints a dedicated overlay');
assert(transitionSrc.includes('--up-reveal-r'), 'circle radius is a registered custom property');
assert(transitionSrc.includes('updatePlaybackRate'), 'in-flight toggle reverses playback from the current time');
assert(!transitionSrc.includes('.then(finish, finish)'), 'reverse must not treat a rejected finished promise as done');
assert(transitionSrc.includes('playingForward'), 'reverse keeps the freeze until the circle returns');
const busyStart = transitionSrc.indexOf('if (activeReveal)');
const busyEnd = transitionSrc.indexOf('const root = document.documentElement');
const busyBlock = busyStart >= 0 && busyEnd > busyStart ? transitionSrc.slice(busyStart, busyEnd) : '';
assert(busyBlock.includes('flipPlayback'), 'busy click flips the in-flight circle');
assert(!busyBlock.includes('apply()'), 'busy click does not snap the live theme');
assert(transitionSrc.includes("createElement('html')"), 'freeze layer is a document-shaped shadow');
assert(transitionSrc.includes('showPopover'), 'overlay uses the top layer so Firefox chrome cannot paint above it');
assert(transitionSrc.includes('backdrop-filter: none !important'), 'freeze layer drops backdrop-filter so Firefox masks sticky chrome');

const css = readFileSync(join(here, '../index.css'), 'utf8');
assert(!css.includes('html.is-theme-revealing *'), 'no universal revealing selector');
assert(!css.includes('html.is-theme-revealing::view-transition'), 'no root view-transition reveal rules');
assert(css.includes('.up-theme-reveal-veil'), 'overlay class is present');
assert(css.includes('mask-image'), 'overlay is masked, not a solid disk');
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
