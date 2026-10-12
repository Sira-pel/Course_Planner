import type { DayOfWeek } from '../types/schedule';
import type { GeneratorResult } from './planGenerator';

export interface RememberedBlock {
  id: string;
  day: DayOfWeek;
  start: string;
  end: string;
}

/** What Generate should still know after the dialog closes. */
export interface GeneratorSession {
  step: 1 | 2 | 3;
  picked: string[];
  pinned: string[];
  lockedIds: string[];
  excludedIds: string[];
  blocked: RememberedBlock[];
  result: GeneratorResult | null;
  previewId: string | null;
}

let current: GeneratorSession | null = null;

export function readGeneratorSession(): GeneratorSession | null {
  return current;
}

export function writeGeneratorSession(session: GeneratorSession): void {
  current = session;
}

/** Step 3 with no finished result is the in-progress search, so reopen on preferences. */
export function reopenGeneratorStep(session: GeneratorSession | null): 1 | 2 | 3 {
  if (!session) return 1;
  if (session.step === 3 && !session.result) return 2;
  return session.step;
}
