import { nextMeasuredWidth } from './calendarMeasure';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(nextMeasuredWidth(800, 800.4) === 800, 'subpixel width jitter keeps the previous width');
assert(nextMeasuredWidth(800, 860) === 860, 'a real width change is stored');
assert(nextMeasuredWidth(800, 0) === 800, 'an empty measurement is ignored');
assert(nextMeasuredWidth(800, -1) === 800, 'a negative measurement is ignored');

console.log('calendar measure tests passed');
