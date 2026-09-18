import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAYOUT_HYSTERESIS_PX,
  PHONE_MAX_PX,
  TABLET_MAX_PX,
  layoutFromMatchMedia,
  stabilizePoolLayout,
} from './layoutBreakpoint';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(layoutFromMatchMedia(true, false) === 'phone', 'phone media');
assert(layoutFromMatchMedia(false, true) === 'tablet', 'tablet media');
assert(layoutFromMatchMedia(false, false) === 'desktop', 'desktop media');

// Classic-scrollbar oscillation around 640px must not remount phone ↔ tablet.
const jitterLow = PHONE_MAX_PX - 6; // 633
const jitterHigh = PHONE_MAX_PX + 11; // 650
assert(jitterHigh <= PHONE_MAX_PX + LAYOUT_HYSTERESIS_PX, 'test band covers 650');

let layout = stabilizePoolLayout(jitterLow, 'phone', 'phone');
layout = stabilizePoolLayout(jitterHigh, layout, 'tablet');
assert(layout === 'phone', `stay phone on 650 jitter, got ${layout}`);
layout = stabilizePoolLayout(jitterLow, layout, 'phone');
assert(layout === 'phone', 'still phone after 633');

layout = stabilizePoolLayout(jitterHigh, 'tablet', 'tablet');
layout = stabilizePoolLayout(jitterLow, layout, 'phone');
assert(layout === 'tablet', `stay tablet on 633 jitter, got ${layout}`);

// Real resize out of the band commits.
layout = stabilizePoolLayout(PHONE_MAX_PX + LAYOUT_HYSTERESIS_PX + 1, 'phone', 'tablet');
assert(layout === 'tablet', 'commit tablet past hysteresis');
layout = stabilizePoolLayout(PHONE_MAX_PX - LAYOUT_HYSTERESIS_PX, 'tablet', 'phone');
assert(layout === 'phone', 'commit phone past hysteresis');

const deskJitterLow = TABLET_MAX_PX + 1 - 16; // 1008
const deskJitterHigh = TABLET_MAX_PX + 1 + 16; // 1040
layout = stabilizePoolLayout(deskJitterHigh, 'desktop', 'desktop');
layout = stabilizePoolLayout(deskJitterLow, layout, 'tablet');
assert(layout === 'desktop', `stay desktop on 1008 jitter, got ${layout}`);

layout = stabilizePoolLayout(deskJitterLow, 'tablet', 'tablet');
layout = stabilizePoolLayout(deskJitterHigh, layout, 'desktop');
assert(layout === 'tablet', `stay tablet on 1040 jitter, got ${layout}`);

layout = stabilizePoolLayout(TABLET_MAX_PX + 1 + LAYOUT_HYSTERESIS_PX, 'tablet', 'desktop');
assert(layout === 'desktop', 'commit desktop past hysteresis');

assert(LAYOUT_HYSTERESIS_PX === 24, 'hysteresis stays wider than a classic scrollbar');

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
assert(css.includes('scrollbar-gutter: stable'), 'html keeps a stable scrollbar gutter');
assert(/html,\s*body,\s*#root \{[^}]*overflow-x: clip/s.test(css), 'document locks overflow-x at every breakpoint');
assert(/html,\s*body,\s*#root \{[^}]*overflow-y: hidden/s.test(css), 'document locks overflow-y at every breakpoint');
const appIdx = css.indexOf('.up-app {');
assert(appIdx !== -1, '.up-app rule exists');
const beforeApp = css.slice(0, appIdx);
const lastMedia = beforeApp.lastIndexOf('@media');
const lastBrace = beforeApp.lastIndexOf('}');
assert(lastBrace > lastMedia, '.up-app overflow lock is not inside a max-width query');
const appBlock = css.slice(appIdx, css.indexOf('}', appIdx) + 1);
assert(appBlock.includes('overflow: hidden'), '.up-app overflow is locked at every breakpoint');

console.log('layoutBreakpoint tests passed');
