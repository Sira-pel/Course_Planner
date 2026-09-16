export type PoolLayout = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX_PX = 639;
export const TABLET_MAX_PX = 1023;
/** Wider than a classic scrollbar (~15–17px) so presence/width jitter cannot remount chrome. */
export const LAYOUT_HYSTERESIS_PX = 24;

export function layoutFromMatchMedia(phone: boolean, tablet: boolean): PoolLayout {
  if (phone) return 'phone';
  if (tablet) return 'tablet';
  return 'desktop';
}

/**
 * Keep the current layout when width is still inside the scrollbar-jitter band
 * around 640px or 1024px. Crossing further in commits the new layout.
 */
export function stabilizePoolLayout(
  widthPx: number,
  current: PoolLayout,
  raw: PoolLayout
): PoolLayout {
  if (raw === current) return current;

  if (current === 'phone' && raw === 'tablet') {
    return widthPx <= PHONE_MAX_PX + LAYOUT_HYSTERESIS_PX ? 'phone' : 'tablet';
  }
  if (current === 'tablet' && raw === 'phone') {
    return widthPx > PHONE_MAX_PX - LAYOUT_HYSTERESIS_PX ? 'tablet' : 'phone';
  }
  if (current === 'tablet' && raw === 'desktop') {
    return widthPx < TABLET_MAX_PX + 1 + LAYOUT_HYSTERESIS_PX ? 'tablet' : 'desktop';
  }
  if (current === 'desktop' && raw === 'tablet') {
    return widthPx >= TABLET_MAX_PX + 1 - LAYOUT_HYSTERESIS_PX ? 'desktop' : 'tablet';
  }

  return raw;
}
