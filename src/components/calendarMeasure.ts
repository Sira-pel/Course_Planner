/**
 * Keep the last width when a resize is empty or subpixel noise.
 * Row height is a percentage of the grid, so vertical resizes do not need state.
 */
export function nextMeasuredWidth(previous: number, measured: number): number {
  if (!(measured > 0)) return previous;
  if (Math.abs(previous - measured) < 1) return previous;
  return measured;
}
