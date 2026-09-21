import {
  formatFloatingDateTime,
  formatIcsDateTime,
  formatIcsUntil,
  getFirstDayOccurrence,
  getIcsDayInfo,
  parseLocalDate,
  parseSessionTime,
  sessionTimesAreValid,
  uniplanCalendarSummary,
} from './calendarDates';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const tue = parseLocalDate('2026-09-01');
assert(tue !== null, '2026-09-01 parses');
assert(tue?.getFullYear() === 2026 && tue.getMonth() === 8 && tue.getDate() === 1, 'local Y-M-D');
assert(tue?.getDay() === 2, '2026-09-01 is Tuesday');

assert(parseLocalDate('') === null, 'empty date is null');
assert(parseLocalDate('09/01/2026') === null, 'non-ISO date is null');
assert(parseLocalDate('2026-02-31') === null, 'invalid calendar day is null');

assert(getFirstDayOccurrence(tue!, 2).getDate() === 1, 'same-day first occurrence');
assert(getFirstDayOccurrence(tue!, 3).toDateString() === parseLocalDate('2026-09-02')!.toDateString(), 'next Wednesday');
assert(getFirstDayOccurrence(tue!, 1).toDateString() === parseLocalDate('2026-09-07')!.toDateString(), 'next Monday');

const until = formatIcsUntil(parseLocalDate('2026-12-18')!);
assert(until === '20261218T235959', `floating UNTIL, got ${until}`);
assert(!until.endsWith('Z'), 'UNTIL must not use UTC Z');

assert(formatFloatingDateTime(tue!, '09:00') === '2026-09-01T09:00:00', 'floating local dateTime');
assert(formatFloatingDateTime(tue!, '09:00')?.includes('Z') === false, 'floating dateTime has no Z');
assert(formatIcsDateTime(tue!, '10:15') === '20260901T101500', 'ICS local datetime');
assert(formatFloatingDateTime(tue!, '') === null, 'missing time is not defaulted');
assert(formatFloatingDateTime(tue!, '25:00') === null, 'invalid hour is rejected');

assert(parseSessionTime('9:05')?.hours === 9 && parseSessionTime('9:05')?.minutes === 5, 'H:mm parses');
assert(parseSessionTime('24:00') === null, '24:00 is invalid');
assert(sessionTimesAreValid('09:00', '10:00') === true, 'valid range');
assert(sessionTimesAreValid('10:00', '09:00') === false, 'end before start is invalid');
assert(sessionTimesAreValid(undefined, '10:00') === false, 'missing start is invalid');
assert(sessionTimesAreValid('09:00', '') === false, 'empty end is invalid');

assert(getIcsDayInfo('monday')?.code === 'MO' && getIcsDayInfo('monday')?.jsDay === 1, 'monday map');
assert(getIcsDayInfo('not-a-day') === null, 'unknown day is null');
assert(uniplanCalendarSummary('Plan A') === 'Plan A - Uniplan', 'calendar summary');
assert(uniplanCalendarSummary() === 'My Schedule - Uniplan', 'default calendar summary');

console.log('calendarDates tests passed');
