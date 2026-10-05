/**
 * Keep the last width when a resize is empty or subpixel/minor noise.
 * Row height is a percentage of the grid, so vertical resizes do not need state.
 */
export function nextMeasuredWidth(previous: number, measured: number, threshold = 2): number {
  if (!(measured > 0)) return previous;
  if (Math.abs(previous - measured) < threshold) return previous;
  return measured;
}

