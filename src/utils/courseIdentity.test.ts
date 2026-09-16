import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { courseIdentityKey, sameCourseIdentity } from './courseIdentity';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(
  courseIdentityKey('CS 101', '01') !== courseIdentityKey('CS101', '01'),
  'internal spaces are not collapsed'
);
assert(courseIdentityKey(' cs 101 ', ' 01 ') === courseIdentityKey('CS 101', '01'), 'trim and case only');
assert(courseIdentityKey('CS 101') === 'CS 101__', 'missing section is empty after separator');
assert(
  sameCourseIdentity({ code: 'cs 101', section: '01' }, { code: 'CS 101', section: '01' }),
  'sameCourseIdentity matches trimmed/cased code+section'
);
assert(
  !sameCourseIdentity({ code: 'CS 101', section: '01' }, { code: 'CS101', section: '01' }),
  'CS 101 and CS101 stay distinct'
);

const identitySrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'courseIdentity.ts'), 'utf8');
assert(!identitySrc.includes('icsImport'), 'courseIdentity does not import ICS helper');
assert(!identitySrc.includes('.name'), 'courseIdentity key does not include name');

const icsSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'icsImport.ts'), 'utf8');
assert(!icsSrc.includes('courseIdentity'), 'ICS helper is not imported from courseIdentity');

console.log('courseIdentity tests passed');
