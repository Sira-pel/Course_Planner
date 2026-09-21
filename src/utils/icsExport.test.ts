import type { SchedulePlan } from '../types/schedule';
import { generateIcsCalendar } from './icsExport';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const plan: SchedulePlan = {
  id: 'plan_1',
  name: 'Plan A',
  courses: [
    {
      id: 'c1',
      code: 'CS101',
      name: 'Intro',
      credits: 3,
      color: '#3B82F6',
      sessions: [
        { id: 's1', day: 'tuesday', startTime: '10:00', endTime: '11:15', room: '204' },
        { id: 's2', day: 'wednesday', startTime: '', endTime: '10:00' },
      ],
    },
  ],
};

const ics = generateIcsCalendar(plan, '2026-09-01', '2026-12-18');
assert(ics.includes('UNTIL=20261218T235959;BYDAY=TU'), 'ICS UNTIL is floating local');
assert(!ics.includes('T235959Z'), 'ICS UNTIL has no UTC Z');
assert(ics.includes('DTSTART:20260901T100000'), 'valid session keeps floating DTSTART');
assert(!ics.includes('DTSTART:20260902T090000'), 'invalid session is not defaulted to 09:00');
assert((ics.match(/BEGIN:VEVENT/g) || []).length === 1, 'only valid sessions are exported');

console.log('icsExport tests passed');
