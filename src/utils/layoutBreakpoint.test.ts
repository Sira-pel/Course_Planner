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

console.log('layoutBreakpoint tests passed');
