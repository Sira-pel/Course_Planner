import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SchedulePlan } from '../types/schedule';
import {
  INVALID_SHARE_LINK_MESSAGE,
  decodePlanFromSharePayload,
  encodePlanToShareUrl,
  extractSharePayloadFromUrl,
} from './shareLink';

describe('share links', () => {
  it('does not throw when the hash contains a truncated percent escape', () => {
    assert.equal(extractSharePayloadFromUrl('#share=%E0'), null);
    assert.equal(extractSharePayloadFromUrl('https://uniplan.app/#share=%E0'), null);
    const decoded = decodePlanFromSharePayload('%E0');
    assert.equal(decoded.success, false);
    assert.equal(decoded.error, INVALID_SHARE_LINK_MESSAGE);
  });

  it('round-trips a plan and keeps the token inside the base64url alphabet', () => {
    const plan: SchedulePlan = {
      id: 'plan_a',
      name: 'Plan A',
      courses: [
        {
          id: 'c1',
          code: 'MATH 234A',
          name: 'Analytic Geometry and Calculus I',
          section: '002',
          instructor: 'Sa MATH',
          credits: 4,
          color: '#3B82F6',
          sessions: [
            { id: 's1', day: 'tuesday', startTime: '10:15', endTime: '12:45', room: 'Lecture Theater C13.1 (TLC)' },
            { id: 's2', day: 'friday', startTime: '10:15', endTime: '12:45', room: 'Lecture Theater C13.1 (TLC)' },
          ],
        },
      ],
    };

    const url = encodePlanToShareUrl(plan);
    const token = url.split('#share=')[1];
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    const payload = extractSharePayloadFromUrl(url);
    assert.equal(payload, token);
    const decoded = decodePlanFromSharePayload(payload || '');
    assert.equal(decoded.success, true);
    const course = decoded.plan?.courses[0];
    assert.equal(course?.code, 'MATH 234A');
    assert.equal(course?.section, '002');
    assert.equal(course?.instructor, 'Sa MATH');
    assert.equal(course?.credits, 4);
    assert.deepEqual(
      course?.sessions.map((session) => session.day).sort(),
      ['friday', 'tuesday']
    );
  });
});
