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
assert(!transitionSrc.includes('clip-path'), 'theme reveal does not clip-path the overlay in CSS strings');
assert(transitionSrc.includes('up-theme-reveal-veil'), 'theme reveal paints a dedicated overlay');
assert(transitionSrc.includes('up-theme-reveal-disk'), 'theme reveal scales a disk from the pointer');
assert(transitionSrc.includes('scale(0)'), 'collapsed night is a zero scale, not a zero-radius clip');

const css = readFileSync(join(here, '../index.css'), 'utf8');
assert(!css.includes('html.is-theme-revealing *'), 'no universal revealing selector');
assert(!css.includes('html.is-theme-revealing::view-transition'), 'no root view-transition reveal rules');
assert(css.includes('.up-theme-reveal-veil'), 'overlay class is present');
assert(css.includes('.up-theme-reveal-disk'), 'disk class is present');
assert(css.includes('html.is-theme-revealing .up-chrome-btn'), 'chrome buttons skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-pool-tab'), 'pool tabs skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .up-pool-row'), 'pool rows skip color transitions during reveal');
assert(css.includes('html.is-theme-revealing .transition-colors'), 'transition-colors skip during reveal');
assert(css.includes('html.is-theme-revealing .transition-all'), 'transition-all skip during reveal');
assert(css.includes('html.is-theme-revealing .transition-opacity'), 'transition-opacity skip during reveal');
assert(css.includes('transition: none !important'), 'reveal kills transitions with none, not 0s');

console.log('themeTransition tests passed');
