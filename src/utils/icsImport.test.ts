import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIcsContent } from './icsImport';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'icsImport.ts'), 'utf8');
assert(!src.includes('Math.random'), 'icsImport does not use Math.random');
assert(!src.includes('Date.now()'), 'icsImport does not use Date.now');

const uuidRe = /^c_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const withDescription = parseIcsContent([
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:CS101 Intro',
  'DTSTART:20260901T140000',
  'DTEND:20260901T151500',
  'RRULE:FREQ=WEEKLY;BYDAY=TU,TH',
  'DESCRIPTION:Instructor: Ada Lovelace | Credits: 4 | Room: Hall 1',
  'LOCATION:Hall 1',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n'));

assert(withDescription.length === 1, 'one course from one vevent');
assert(withDescription[0].instructor === 'Ada Lovelace', 'instructor parsed from DESCRIPTION');
assert(withDescription[0].credits === 4, 'credits parsed from DESCRIPTION');
assert(uuidRe.test(withDescription[0].id), `course id is prefixed uuid, got ${withDescription[0].id}`);
assert(withDescription[0].sessions.length === 2, 'BYDAY creates two sessions');

const noCredits = parseIcsContent([
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:MATH200 Algebra',
  'DTSTART:20260902T090000',
  'DTEND:20260902T101500',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n'));
assert(noCredits[0].credits === 3, 'credits default to 3 when DESCRIPTION has none');
assert(noCredits[0].instructor === undefined, 'instructor omitted when DESCRIPTION has none');

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const localTzIcs = parseIcsContent([
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  `SUMMARY:PHYS100 Lab`,
  `DTSTART;TZID=${localTz}:20260901T090000`,
  `DTEND;TZID=${localTz}:20260901T101500`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n'));
assert(localTzIcs[0].sessions[0].startTime === '09:00', 'TZID matching local zone keeps wall-clock time');
assert(localTzIcs[0].sessions[0].endTime === '10:15', 'TZID matching local zone keeps end wall-clock');

const bogusTz = parseIcsContent([
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:CHEM100 Lab',
  'DTSTART;TZID=Not/A_Zone:20260901T110000',
  'DTEND;TZID=Not/A_Zone:20260901T121500',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n'));
assert(bogusTz[0].sessions[0].startTime === '11:00', 'unknown TZID falls back to floating wall-clock');

console.log('icsImport tests passed');
