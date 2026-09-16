import type { ClassSession } from '../../types/schedule';
import {
  daysEqual,
  formatDaysShort,
  MWF,
  patternsToSessions,
  sessionsToPatterns,
  TTH,
} from './meetingPatterns';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function sessionKey(session: ClassSession): string {
  return `${session.day}|${session.startTime}|${session.endTime}|${session.room || ''}`;
}

function sameSessions(a: ClassSession[], b: ClassSession[]): boolean {
  if (a.length !== b.length) return false;
  const as = a.map(sessionKey).sort();
  const bs = b.map(sessionKey).sort();
  return as.every((key, i) => key === bs[i]);
}

const mwfSessions: ClassSession[] = [
  { id: 's1', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'A101' },
  { id: 's2', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'A101' },
  { id: 's3', day: 'friday', startTime: '09:00', endTime: '10:15', room: 'A101' },
];

const grouped = sessionsToPatterns(mwfSessions);
assert(grouped.length === 1, `group-by time+room: expected 1 pattern, got ${grouped.length}`);
assert(daysEqual(grouped[0].days, MWF), `group-by days: expected MWF, got ${grouped[0].days.join(',')}`);
assert(grouped[0].startTime === '09:00', 'group-by startTime');
assert(grouped[0].endTime === '10:15', 'group-by endTime');
assert(grouped[0].room === 'A101', 'group-by room');
assert(formatDaysShort(grouped[0].days) === 'MWF', 'formatDaysShort MWF');

const splitRoom = sessionsToPatterns([
  { id: 'a', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'A' },
  { id: 'b', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'B' },
]);
assert(splitRoom.length === 2, `different rooms must not group, got ${splitRoom.length}`);

const splitTime = sessionsToPatterns([
  { id: 'a', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'A101' },
  { id: 'b', day: 'wednesday', startTime: '10:00', endTime: '11:15', room: 'A101' },
]);
assert(splitTime.length === 2, `different times must not group, got ${splitTime.length}`);

const tthSessions: ClassSession[] = [
  { id: 't1', day: 'thursday', startTime: '13:00', endTime: '14:15' },
  { id: 't2', day: 'tuesday', startTime: '13:00', endTime: '14:15' },
];
const tthGrouped = sessionsToPatterns(tthSessions);
assert(tthGrouped.length === 1, 'TTh same time+empty room groups');
assert(daysEqual(tthGrouped[0].days, TTH), 'TTh days sorted');
assert(formatDaysShort(tthGrouped[0].days) === 'TTh', 'formatDaysShort TTh');

const expanded = patternsToSessions(grouped);
assert(sameSessions(expanded, mwfSessions), 'round-trip: patternsToSessions preserves day/time/room');
const regrouped = sessionsToPatterns(expanded);
assert(regrouped.length === 1, 'round-trip: still one group');
assert(daysEqual(regrouped[0].days, MWF), 'round-trip: days remain MWF');
assert(regrouped[0].startTime === '09:00' && regrouped[0].endTime === '10:15', 'round-trip: times');
assert(regrouped[0].room === 'A101', 'round-trip: room');

const mixed = sessionsToPatterns([
  { id: 'm1', day: 'monday', startTime: '09:00', endTime: '10:15', room: 'A101' },
  { id: 'm2', day: 'wednesday', startTime: '09:00', endTime: '10:15', room: 'A101' },
  { id: 'lab', day: 'friday', startTime: '14:00', endTime: '16:00', room: 'Lab 2' },
]);
assert(mixed.length === 2, `mixed lecture+lab: expected 2 patterns, got ${mixed.length}`);
const mixedRoundTrip = sessionsToPatterns(patternsToSessions(mixed));
assert(mixedRoundTrip.length === 2, 'round-trip mixed still 2 patterns');
assert(
  sameSessions(patternsToSessions(mixed), patternsToSessions(mixedRoundTrip)),
  'round-trip mixed sessions match'
);

console.log('meetingPatterns tests passed');
