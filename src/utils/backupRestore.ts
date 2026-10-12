import type { Course, SchedulePlan } from '../types/schedule';
import { PERSIST_SCHEMA_VERSION, resolvePersistedVersion } from '../store/persist';
import { sanitizeCatalog, sanitizePlans } from '../store/sanitize';

export const BACKUP_READ_ERROR = 'This backup could not be read. Use a Uniplan JSON backup and try again.';
export const BACKUP_EMPTY_ERROR = 'This backup has no plans to restore.';

export interface LoadedBackup {
  plans: SchedulePlan[];
  activePlanId: string;
  /** Null when the file has no course pool, so the current pool should stay. */
  catalogCourses: Course[] | null;
  raw: Record<string, unknown>;
}

function migrateBackupPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const from = resolvePersistedVersion(raw.version);
  const next: Record<string, unknown> = { ...raw };
  if (from < 1) {
    // v0 backups only had plans/catalog; prefs and semester dates are optional keys.
  }
  if (from < 2) {
    // v2 prefs are optional. Missing keys keep the current store values.
  }
  next.version = PERSIST_SCHEMA_VERSION;
  return next;
}

function parseBackupJson(jsonString: string): unknown {
  return JSON.parse(jsonString, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}

export function loadBackup(jsonString: string): { ok: true; backup: LoadedBackup } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = parseBackupJson(jsonString);
  } catch {
    return { ok: false, error: BACKUP_READ_ERROR };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: BACKUP_READ_ERROR };
  }

  const raw = migrateBackupPayload(parsed as Record<string, unknown>);
  if (!Array.isArray(raw.plans) || raw.plans.length === 0) {
    return { ok: false, error: BACKUP_EMPTY_ERROR };
  }

  let plans: SchedulePlan[];
  try {
    plans = sanitizePlans(raw.plans);
  } catch {
    return { ok: false, error: BACKUP_READ_ERROR };
  }
  if (plans.length === 0) return { ok: false, error: BACKUP_EMPTY_ERROR };

  const activePlanId = plans.some((plan) => plan.id === raw.activePlanId)
    ? String(raw.activePlanId)
    : plans[0].id;

  const catalogCourses = Object.prototype.hasOwnProperty.call(raw, 'catalogCourses')
    ? (Array.isArray(raw.catalogCourses) ? sanitizeCatalog(raw.catalogCourses) : [])
    : null;

  return { ok: true, backup: { plans, activePlanId, catalogCourses, raw } };
}

export function countCourses(plans: { courses: readonly unknown[] }[]): number {
  return plans.reduce((sum, plan) => sum + plan.courses.length, 0);
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function schedulePhrase(plans: number, courses: number): string {
  return `${countPhrase(plans, 'plan', 'plans')} and ${countPhrase(courses, 'course', 'courses')}`;
}

/** What Apply will replace, using the schedule that is open and the backup's counts. */
export function backupReplaceMessage(
  current: { plans: number; courses: number },
  next: { plans: number; courses: number },
): string {
  return `This replaces your ${schedulePhrase(current.plans, current.courses)} with the backup's ${schedulePhrase(next.plans, next.courses)}. You can undo it.`;
}
