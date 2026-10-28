import type { ClassSession, Course, DayOfWeek } from '../types/schedule';
import { DAYS_LIST } from '../types/schedule';
import { displayCourseTitle } from './courseIdentity';
import { MAX_CANDIDATES, type GapLimit } from './generatorPrefs';
import { checkSessionCollision, minutesToTime, timeToMinutes } from './timeUtils';

export { MAX_CANDIDATES };
/** Mixes evaluated before a search pauses. The same search can raise this and continue. */
export const MAX_EVALUATIONS = 5000;
/** Course groups revealed at a time. The search keeps every group it has ranked. */
export const MAX_RESULTS = 5;

const DAY_LABEL = new Map(DAYS_LIST.map((day) => [day.id, day.label]));
const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export interface CourseGroup {
  key: string;
  code: string;
  name: string;
  color: string;
  sections: Course[];
}

export interface BlockedWindow {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
}

export interface GeneratorPreferences {
  mode: 'courses' | 'credits';
  courseCount: number;
  creditMin: number;
  creditMax: number;
  gapsEnabled: boolean;
  gapLimit: GapLimit;
  lunchEnabled: boolean;
  lunchStart: number;
  lunchEnd: number;
  lunchMinutes: number;
  daysOff: DayOfWeek[];
  /** Maximum distinct courses that may meet on one day. Null means no cap. */
  dailyCap: number | null;
  classStart: number | null;
  classEnd: number | null;
  blocked: BlockedWindow[];
  lockedSectionIds: string[];
  excludedSectionIds: string[];
}

export interface GeneratorInput {
  groups: CourseGroup[];
  pinnedKeys: string[];
  preferences: GeneratorPreferences;
}

export interface GeneratedPlan {
  id: string;
  /** Course codes in this mix. Section variants of the same courses share this key. */
  groupKey: string;
  courses: Course[];
  pinnedCodes: string[];
  includedCodes: string[];
  skippedCodes: string[];
  tags: string[];
  score: number;
}

export interface GeneratorResult {
  plans: GeneratedPlan[];
  evaluated: number;
  validCount: number;
  capped: boolean;
  estimate: number;
  emptyReason: string | null;
  /** Requested days off that no mix can honor, with the course or locked section that blocks them. */
  dayOffNotices: string[];
  /** Set when the gap limit ruled out every mix and the list is the closest soft-scored plans. */
  gapNotice: string | null;
  /** Unpinned picks that have no usable section, left out of the search. Missing in results saved earlier. */
  leftOut?: { code: string; reason: string }[];
}

export interface GeneratorSearch {
  readonly done: boolean;
  readonly evaluated: number;
  readonly capped: boolean;
  readonly estimate: number;
  advance(limit: number): void;
  /** Keep going from the current mix. Does not restart or drop mixes already ranked. */
  raiseLimit(extra?: number): void;
  result(): GeneratorResult;
}

export function courseCodeKey(code: string): string {
  return (code || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function groupCoursesByCode(courses: Course[]): CourseGroup[] {
  const order: string[] = [];
  const map = new Map<string, CourseGroup>();
  for (const course of courses) {
    const key = courseCodeKey(course.code);
    if (!key) continue;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        code: (course.code || '').trim().replace(/\s+/g, ' '),
        name: displayCourseTitle(course),
        color: course.color,
        sections: [],
      };
      map.set(key, group);
      order.push(key);
    } else if (!group.name) {
      group.name = displayCourseTitle(course);
    }
    group.sections.push(course);
  }
  return order.map((key) => map.get(key)!);
}

export function creditBounds(target: number, pinnedCredits: number): { min: number; max: number } {
  const max = Math.max(0, Math.round(Math.max(target, pinnedCredits)));
  const min = Math.min(max, Math.max(0, Math.round(Math.max(pinnedCredits, max - 3))));
  return { min, max };
}

export function nextGeneratedPlanName(plans: { name: string }[]): string {
  let max = 0;
  for (const plan of plans) {
    const match = /^Generated (\d+)$/.exec((plan.name || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Generated ${max + 1}`;
}

interface PreparedGroup {
  key: string;
  code: string;
  name: string;
  sections: Course[];
  minCredits: number;
  maxCredits: number;
}

interface MixJob {
  groups: PreparedGroup[];
  /** Next section index to try at each depth. Null until the job starts. */
  nextIndex: number[] | null;
  /** Sections accepted along the current path. */
  chosen: Course[];
  /** Section indexes in the order to try them at each depth, best fit first. */
  orders: number[][];
  done: boolean;
}

interface ScoredMix {
  courses: Course[];
  score: number;
  signature: string;
}

interface Bucket {
  items: ScoredMix[];
}

function courseCredits(course: Course): number {
  return typeof course.credits === 'number' && Number.isFinite(course.credits) ? course.credits : 0;
}

function sectionSelfClashes(course: Course): boolean {
  const sessions = course.sessions || [];
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      if (checkSessionCollision(sessions[i], sessions[j])) return true;
    }
  }
  return false;
}

function overlapsBlocked(course: Course, blocked: BlockedWindow[]): boolean {
  for (const block of blocked) {
    if (block.endMinutes <= block.startMinutes) continue;
    const phantom: ClassSession = {
      id: 'blocked',
      day: block.day,
      startTime: minutesToTime(block.startMinutes, false),
      endTime: minutesToTime(block.endMinutes, false),
    };
    for (const session of course.sessions || []) {
      if (checkSessionCollision(session, phantom)) return true;
    }
  }
  return false;
}

function mixClashes(courses: Course[]): boolean {
  for (let i = 0; i < courses.length; i += 1) {
    const left = courses[i].sessions || [];
    for (let j = i + 1; j < courses.length; j += 1) {
      const right = courses[j].sessions || [];
      for (const a of left) {
        for (const b of right) {
          if (checkSessionCollision(a, b)) return true;
        }
      }
    }
  }
  return false;
}

function pairAlwaysClashes(left: Course[], right: Course[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  for (const a of left) {
    for (const b of right) {
      if (!mixClashes([a, b])) return false;
    }
  }
  return true;
}

function buildClashingPairs(groups: PreparedGroup[]): Map<string, Set<string>> {
  const clashes = new Map<string, Set<string>>();
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const left = groups[i];
      const right = groups[j];
      if (left.sections.length * right.sections.length > 240) continue;
      if (!pairAlwaysClashes(left.sections, right.sections)) continue;
      let leftSet = clashes.get(left.key);
      if (!leftSet) {
        leftSet = new Set();
        clashes.set(left.key, leftSet);
      }
      leftSet.add(right.key);
    }
  }
  return clashes;
}

/** True when some course pair inside this set can never share a plan. Large pairs stay in the search. */
function subsetNeverFits(groups: PreparedGroup[], clashes: Map<string, Set<string>>): boolean {
  for (let i = 0; i < groups.length; i += 1) {
    const leftSet = clashes.get(groups[i].key);
    if (!leftSet) continue;
    for (let j = i + 1; j < groups.length; j += 1) {
      if (leftSet.has(groups[j].key)) return true;
    }
  }
  return false;
}

function unusableReason(group: CourseGroup, prefs: GeneratorPreferences): string | null {
  const excluded = new Set(prefs.excludedSectionIds);
  const locked = new Set(prefs.lockedSectionIds);
  const afterExclude = group.sections.filter((section) => !excluded.has(section.id));
  if (group.sections.length > 0 && afterExclude.length === 0) {
    return `${group.code} has no section left after exclusions`;
  }
  const hasLock = group.sections.some((section) => locked.has(section.id));
  const afterLock = hasLock
    ? afterExclude.filter((section) => locked.has(section.id))
    : afterExclude;
  if (hasLock && afterLock.length === 0) {
    return `${group.code} has no section matching the lock`;
  }
  const afterSelf = afterLock.filter((section) => !sectionSelfClashes(section));
  if (afterLock.length > 0 && afterSelf.length === 0) {
    return `${group.code} has overlapping meetings in every section`;
  }
  const afterBlock = afterSelf.filter((section) => !overlapsBlocked(section, prefs.blocked));
  if (afterSelf.length > 0 && afterBlock.length === 0) {
    return `${group.code} has no section outside your blocked times`;
  }
  if (afterBlock.length === 0) return `${group.code} has no usable section`;
  return null;
}

function prepareGroup(group: CourseGroup, prefs: GeneratorPreferences): PreparedGroup {
  const excluded = new Set(prefs.excludedSectionIds);
  const locked = new Set(prefs.lockedSectionIds);
  const hasLock = group.sections.some((section) => locked.has(section.id));
  let sections = group.sections.filter((section) => !excluded.has(section.id) && !sectionSelfClashes(section));
  if (hasLock) {
    sections = sections.filter((section) => locked.has(section.id));
  }
  sections = sections.filter((section) => !overlapsBlocked(section, prefs.blocked));
  const credits = sections.map(courseCredits);
  return {
    key: group.key,
    code: group.code,
    name: group.name,
    sections,
    minCredits: credits.length > 0 ? Math.min(...credits) : 0,
    maxCredits: credits.length > 0 ? Math.max(...credits) : 0,
  };
}

function subsetCreditsOk(groups: PreparedGroup[], prefs: GeneratorPreferences): boolean {
  if (prefs.mode !== 'credits') return true;
  const min = groups.reduce((sum, group) => sum + group.minCredits, 0);
  const max = groups.reduce((sum, group) => sum + group.maxCredits, 0);
  return min <= prefs.creditMax && max >= prefs.creditMin;
}

function mixCreditsOk(courses: Course[], prefs: GeneratorPreferences): boolean {
  if (prefs.mode !== 'credits') return true;
  const total = courses.reduce((sum, course) => sum + courseCredits(course), 0);
  return total >= prefs.creditMin && total <= prefs.creditMax;
}

function mixProduct(groups: PreparedGroup[]): number {
  let product = 1;
  for (const group of groups) {
    product *= group.sections.length;
    if (product > 1_000_000) return 1_000_000;
  }
  return product;
}

function sectionClashesWithChosen(section: Course, chosen: Course[]): boolean {
  const sessions = section.sessions || [];
  for (const other of chosen) {
    const otherSessions = other.sessions || [];
    for (const left of sessions) {
      for (const right of otherSessions) {
        if (checkSessionCollision(left, right)) return true;
      }
    }
  }
  return false;
}

function collectDays(courses: Course[]): Map<DayOfWeek, [number, number][]> {
  const days = new Map<DayOfWeek, [number, number][]>();
  for (const course of courses) {
    for (const session of course.sessions || []) {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      if (end <= start) continue;
      const list = days.get(session.day);
      if (list) list.push([start, end]);
      else days.set(session.day, [[start, end]]);
    }
  }
  for (const list of days.values()) list.sort((a, b) => a[0] - b[0]);
  return days;
}

function dayHasLunch(
  intervals: [number, number][],
  windowStart: number,
  windowEnd: number,
  needed: number,
): boolean {
  if (windowEnd - windowStart < needed) return false;
  let cursor = windowStart;
  for (const [start, end] of intervals) {
    const clipStart = Math.max(start, windowStart);
    const clipEnd = Math.min(end, windowEnd);
    if (clipEnd <= clipStart) continue;
    if (clipStart - cursor >= needed) return true;
    cursor = Math.max(cursor, clipEnd);
  }
  return windowEnd - cursor >= needed;
}

function maxCoursesOnOneDay(courses: Course[]): number {
  const byDay = new Map<DayOfWeek, Set<string>>();
  for (const course of courses) {
    for (const session of course.sessions || []) {
      let ids = byDay.get(session.day);
      if (!ids) {
        ids = new Set();
        byDay.set(session.day, ids);
      }
      ids.add(course.id);
    }
  }
  let max = 0;
  for (const ids of byDay.values()) {
    if (ids.size > max) max = ids.size;
  }
  return max;
}

function withinDailyCap(courses: Course[], prefs: GeneratorPreferences): boolean {
  if (prefs.dailyCap == null) return true;
  return maxCoursesOnOneDay(courses) <= prefs.dailyCap;
}

function formatGap(minutes: number): string {
  if (minutes <= 0) return 'No gaps';
  if (minutes < 60) return `Max gap ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `Max gap ${hours}h`;
  return `Max gap ${hours}h ${rest}m`;
}

function gapLimitPhrase(limit: number): string {
  if (limit > 0 && limit % 60 === 0) {
    const hours = limit / 60;
    if (hours === 1) return '1h';
    if (hours === 2) return '2h';
    return `${hours}h`;
  }
  return `${limit}m`;
}

export function gapFallbackNotice(limit: number): string {
  return `No plans fit a ${gapLimitPhrase(limit)} gap limit; showing closest matches.`;
}

function scoreMix(courses: Course[], prefs: GeneratorPreferences): { score: number; tags: string[]; maxGap: number } {
  const days = collectDays(courses);
  let score = 0;
  let maxGap = 0;
  const gaps: number[] = [];
  for (const intervals of days.values()) {
    for (let index = 1; index < intervals.length; index += 1) {
      const gap = intervals[index][0] - intervals[index - 1][1];
      if (gap <= 0) continue;
      gaps.push(gap);
      if (gap > maxGap) maxGap = gap;
    }
  }
  if (prefs.gapsEnabled) {
    for (const gap of gaps) {
      if (gap > prefs.gapLimit) score += gap - prefs.gapLimit;
    }
  }
  score += maxGap * 0.01;

  const lunchWindowOk = prefs.lunchEnd - prefs.lunchStart >= prefs.lunchMinutes;
  let missingLunch = 0;
  if (prefs.lunchEnabled && lunchWindowOk) {
    for (const intervals of days.values()) {
      if (!dayHasLunch(intervals, prefs.lunchStart, prefs.lunchEnd, prefs.lunchMinutes)) missingLunch += 1;
    }
    score += missingLunch * 120;
  }

  const hasClass = (day: DayOfWeek) => days.has(day);
  for (const day of prefs.daysOff) {
    if (hasClass(day)) score += 80;
    else score -= 25;
  }

  for (const course of courses) {
    for (const session of course.sessions || []) {
      const start = timeToMinutes(session.startTime);
      const end = timeToMinutes(session.endTime);
      if (end <= start) continue;
      if (prefs.classStart != null && start < prefs.classStart) score += prefs.classStart - start;
      if (prefs.classEnd != null && end > prefs.classEnd) score += end - prefs.classEnd;
    }
  }

  score += days.size * 0.5;

  const tags: string[] = [];
  const freeWeekdays = WEEKDAYS.filter((day) => !hasClass(day));
  if (freeWeekdays.length > 0) {
    const names = freeWeekdays.map((day) => DAY_LABEL.get(day) ?? day);
    tags.push(`${names.join(', ')} off`);
  }
  tags.push(formatGap(maxGap));
  if (prefs.dailyCap != null) tags.push(`Max ${prefs.dailyCap} a day`);
  if (prefs.lunchEnabled && lunchWindowOk && missingLunch === 0 && days.size > 0) tags.push('Lunch free');
  return { score, tags, maxGap };
}

function lockedSectionLabel(code: string, section: Course): string {
  const sec = (section.section || '').trim();
  return sec ? `${code} · ${sec}` : code;
}

function sectionMeets(section: Course, day: DayOfWeek): boolean {
  return (section.sessions || []).some((session) => session.day === day);
}

function lockedSectionsIn(groups: PreparedGroup[], prefs: GeneratorPreferences): { code: string; key: string; section: Course }[] {
  const locked = new Set(prefs.lockedSectionIds);
  const found: { code: string; key: string; section: Course }[] = [];
  for (const group of groups) {
    for (const section of group.sections) {
      if (locked.has(section.id)) found.push({ code: group.code, key: group.key, section });
    }
  }
  return found;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Hint above Search deeper. An empty capped search may still have plans; one that already found some may have better ones. */
export function cappedSearchHint(evaluated: number, planCount: number): string {
  const prospect = planCount === 0 ? 'There may still be plans' : 'There may be better plans';
  return `Checked ${formatCount(evaluated)} mixes. ${prospect}`;
}

function explainEmpty(
  groups: PreparedGroup[],
  pinned: Set<string>,
  prefs: GeneratorPreferences,
  capped: boolean,
  evaluated: number,
): string {
  const locks = lockedSectionsIn(groups, prefs);
  for (let i = 0; i < locks.length; i += 1) {
    for (let j = i + 1; j < locks.length; j += 1) {
      if (locks[i].key === locks[j].key) continue;
      if (!mixClashes([locks[i].section, locks[j].section])) continue;
      const left = lockedSectionLabel(locks[i].code, locks[i].section);
      const right = lockedSectionLabel(locks[j].code, locks[j].section);
      return `${left} overlaps ${right}.`;
    }
  }
  for (const lock of locks) {
    for (const group of groups) {
      if (group.key === lock.key || !pinned.has(group.key) || group.sections.length === 0) continue;
      if (!pairAlwaysClashes([lock.section], group.sections)) continue;
      return `${lockedSectionLabel(lock.code, lock.section)} overlaps every section of ${group.code}.`;
    }
  }

  const ordered = [
    ...groups.filter((group) => pinned.has(group.key)),
    ...groups.filter((group) => !pinned.has(group.key)),
  ];
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const left = ordered[i];
      const right = ordered[j];
      if (left.sections.length * right.sections.length > 240) continue;
      if (pairAlwaysClashes(left.sections, right.sections)) {
        return `${left.code} overlaps every section of ${right.code}.`;
      }
    }
  }
  if (capped) {
    return `Checked ${formatCount(evaluated)} mixes and none were clash-free yet. Search deeper, narrow the list, or clear a blocked time.`;
  }
  return 'No clash-free mix fits these courses and filters.';
}

function dayOffNotices(groups: PreparedGroup[], pinned: Set<string>, prefs: GeneratorPreferences): string[] {
  const notices: string[] = [];
  const locks = lockedSectionsIn(groups, prefs);
  for (const day of prefs.daysOff) {
    const full = DAYS_LIST.find((item) => item.id === day)?.full ?? day;
    const blockingLock = locks.find((lock) => sectionMeets(lock.section, day));
    if (blockingLock) {
      const label = lockedSectionLabel(blockingLock.code, blockingLock.section);
      notices.push(`${full} off isn't possible: ${label} meets on ${full}.`);
      continue;
    }
    const blockingPin = groups.find((group) => (
      pinned.has(group.key)
      && group.sections.length > 0
      && group.sections.every((section) => sectionMeets(section, day))
    ));
    if (blockingPin) {
      notices.push(`${full} off isn't possible: ${blockingPin.code} meets every ${full}.`);
    }
  }
  return notices;
}

function byBestFit(a: ScoredMix, b: ScoredMix): number {
  return a.score - b.score || (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0);
}

const MIN_VARIED_RESULTS = 3;

/** Best section mix of each course group, best fit first. */
function rankedGroups(buckets: Map<string, Bucket>): ScoredMix[] {
  return [...buckets.values()]
    .map((bucket) => bucket.items[0])
    .filter((item): item is ScoredMix => Boolean(item))
    .sort(byBestFit);
}

/**
 * One plan per course group. When fewer than three groups exist, add the
 * next-best section mixes until the list reaches three.
 */
function rankedPlans(buckets: Map<string, Bucket>): ScoredMix[] {
  const chosen = rankedGroups(buckets);
  if (chosen.length >= MIN_VARIED_RESULTS) return chosen;
  const seen = new Set(chosen.map((item) => item.signature));
  const variants = [...buckets.values()]
    .flatMap((bucket) => bucket.items.slice(1))
    .sort(byBestFit);
  for (const variant of variants) {
    if (chosen.length >= MIN_VARIED_RESULTS) break;
    if (seen.has(variant.signature)) continue;
    seen.add(variant.signature);
    chosen.push(variant);
  }
  return chosen;
}

class PlanSearch implements GeneratorSearch {
  done = false;
  evaluated = 0;
  capped = false;
  estimate = 0;
  validCount = 0;
  overDailyCap = 0;
  emptyReason: string | null = null;
  private leftOut: { code: string; reason: string }[] = [];
  private evaluationLimit = MAX_EVALUATIONS;
  private jobs: MixJob[] = [];
  private cursor = 0;
  private buckets = new Map<string, Bucket>();
  /** Soft-scored mixes that miss the gap limit, used only when nothing fits. */
  private relaxed = new Map<string, Bucket>();
  private prefs: GeneratorPreferences;
  private prepared: PreparedGroup[];
  private pinned: Set<string>;
  private pickedOrder: PreparedGroup[];

  constructor(input: GeneratorInput) {
    this.prefs = input.preferences;
    const lockedIds = new Set(input.preferences.lockedSectionIds);
    const lockedKeys = input.groups
      .filter((group) => group.sections.some((section) => lockedIds.has(section.id)))
      .map((group) => group.key);
    this.pinned = new Set([...input.pinnedKeys, ...lockedKeys]);

    if (input.groups.length < 2) {
      this.prepared = input.groups.map((group) => prepareGroup(group, input.preferences));
      this.pickedOrder = this.prepared;
      this.emptyReason = 'Pick at least 2 courses.';
      this.done = true;
      return;
    }

    // A pinned or locked course must be in every plan, so one that cannot be used ends the search.
    // An unpinned one is left out and the rest still run. The cap counts usable courses only.
    const reasons = new Map(input.groups.map((group) => [group.key, unusableReason(group, input.preferences)]));
    const pinnedProblem = input.groups
      .filter((group) => this.pinned.has(group.key))
      .map((group) => reasons.get(group.key))
      .find((reason): reason is string => Boolean(reason));
    const unusable = input.groups.filter((group) => !this.pinned.has(group.key) && reasons.get(group.key));
    this.leftOut = unusable.map((group) => ({ code: group.code, reason: reasons.get(group.key)! }));
    const leftOutKeys = new Set(unusable.map((group) => group.key));
    const picked = input.groups.filter((group) => !leftOutKeys.has(group.key)).slice(0, MAX_CANDIDATES);
    const pinnedGroups = picked.filter((group) => this.pinned.has(group.key));
    this.prepared = picked.map((group) => prepareGroup(group, input.preferences));
    this.pickedOrder = this.prepared;

    if (pinnedProblem) {
      this.emptyReason = pinnedProblem;
      this.done = true;
      return;
    }
    if (picked.length < 2) {
      this.emptyReason = this.leftOut.length > 0
        ? this.leftOut.map((item) => item.reason).join('; ')
        : 'Pick at least 2 courses.';
      this.done = true;
      return;
    }

    const usable = new Map(this.prepared.map((group) => [group.key, group]));
    const pins = pinnedGroups.map((group) => usable.get(group.key)!).filter((group) => group.sections.length > 0);
    const optional = this.prepared.filter((group) => !this.pinned.has(group.key) && group.sections.length > 0);
    const subsets = this.buildSubsets(pins, optional);
    if (subsets.length === 0) {
      if (!this.emptyReason && this.leftOut.length > 0 && this.prefs.mode === 'courses' && pins.length + optional.length < this.prefs.courseCount) {
        this.emptyReason = this.leftOut.map((item) => item.reason).join('; ');
      }
      if (!this.emptyReason && this.prefs.mode === 'credits') {
        const dropped = this.leftOut.map((item) => `${item.reason}, so it was left out.`);
        this.emptyReason = ['No mix of at least 2 courses fits that credit range.', ...dropped].join(' ');
      }
      if (!this.emptyReason) this.emptyReason = 'No course set fits that plan size.';
      this.done = true;
      return;
    }

    const clashingPairs = buildClashingPairs(this.prepared);
    const fitSubsets = clashingPairs.size > 0
      ? subsets.filter((subset) => !subsetNeverFits(subset, clashingPairs))
      : subsets;
    if (fitSubsets.length === 0) {
      this.emptyReason = explainEmpty(this.prepared, this.pinned, this.prefs, false, 0);
      this.done = true;
      return;
    }

    let estimate = 0;
    for (const subset of fitSubsets) {
      const product = mixProduct(subset);
      estimate = Math.min(1_000_000, estimate + product);
      this.jobs.push({
        groups: subset,
        nextIndex: null,
        chosen: [],
        orders: [],
        done: false,
      });
    }
    this.estimate = estimate;
    if (this.jobs.length === 0) this.done = true;
  }

  private buildSubsets(pins: PreparedGroup[], optional: PreparedGroup[]): PreparedGroup[][] {
    if (this.prefs.mode === 'courses') {
      const extra = this.prefs.courseCount - pins.length;
      if (extra < 0 || extra > optional.length) {
        if (pins.length > this.prefs.courseCount) {
          this.emptyReason = 'This plan size is smaller than your pinned courses.';
        }
        return [];
      }
      const subsets: PreparedGroup[][] = [];
      const current = pins.slice();
      const visit = (start: number, remaining: number) => {
        if (remaining === 0) {
          if (current.length >= 2 && subsetCreditsOk(current, this.prefs)) {
            subsets.push(current.slice());
          }
          return;
        }
        const limit = optional.length - remaining;
        for (let index = start; index <= limit; index += 1) {
          current.push(optional[index]);
          visit(index + 1, remaining - 1);
          current.pop();
        }
      };
      visit(0, extra);
      return subsets;
    }

    const pinMin = pins.reduce((sum, group) => sum + group.minCredits, 0);
    if (pinMin > this.prefs.creditMax) {
      const names = pins.map((group) => group.code).join(', ');
      this.emptyReason = `${names} already total at least ${pinMin} credits, above the ${this.prefs.creditMax} credit limit.`;
      return [];
    }

    const pinMax = pins.reduce((sum, group) => sum + group.maxCredits, 0);
    const subsets: PreparedGroup[][] = [];
    const current = pins.slice();
    const visit = (start: number, minSum: number, maxSum: number) => {
      if (current.length >= 2 && minSum <= this.prefs.creditMax && maxSum >= this.prefs.creditMin) {
        subsets.push(current.slice());
      }
      for (let index = start; index < optional.length; index += 1) {
        const group = optional[index];
        const nextMin = minSum + group.minCredits;
        if (group.minCredits >= 0 && nextMin > this.prefs.creditMax) continue;
        current.push(group);
        visit(index + 1, nextMin, maxSum + group.maxCredits);
        current.pop();
      }
    };
    visit(0, pinMin, pinMax);
    return subsets;
  }

  raiseLimit(extra: number = MAX_EVALUATIONS): void {
    if (!Number.isFinite(extra) || extra <= 0) return;
    this.evaluationLimit += Math.floor(extra);
    if (this.jobs.some((job) => !job.done)) {
      this.done = false;
      this.capped = false;
    }
  }

  advance(limit: number): void {
    if (this.done) return;
    let steps = 0;
    let idle = 0;
    while (steps < limit && this.evaluated < this.evaluationLimit) {
      if (this.jobs.length === 0) {
        this.done = true;
        return;
      }
      const job = this.jobs[this.cursor];
      if (job.done) {
        idle += 1;
        this.cursor = (this.cursor + 1) % this.jobs.length;
        if (idle > this.jobs.length) {
          this.done = true;
          return;
        }
        continue;
      }
      idle = 0;
      const outcome = this.stepJob(job);
      if (outcome === 'done') {
        job.done = true;
        this.cursor = (this.cursor + 1) % this.jobs.length;
        continue;
      }
      // Every section tried, including one that skips a clashing branch, spends one step.
      steps += 1;
      if (outcome === 'step') continue;
      this.evaluated += 1;
      this.cursor = (this.cursor + 1) % this.jobs.length;
      if (this.evaluated >= this.evaluationLimit) {
        this.capped = this.jobs.some((item) => !item.done);
        this.done = true;
        return;
      }
    }
    if (this.jobs.every((job) => job.done)) this.done = true;
  }

  /**
   * Try one section. A clash with the sections already chosen skips that branch
   * and counts as one evaluation so a deep clash tree still caps cleanly and
   * advances round-robin across course sets.
   */
  private stepJob(job: MixJob): 'step' | 'evaluated' | 'done' {
    if (!job.nextIndex) {
      job.nextIndex = [0];
      job.chosen = [];
      job.orders = [this.orderSections(job.groups[0].sections, [])];
    }
    const groups = job.groups;
    const nextIndex = job.nextIndex;
    const chosen = job.chosen;

    while (true) {
      const depth = chosen.length;
      if (depth === groups.length) {
        this.scoreChosen(job);
        return 'evaluated';
      }

      const position = nextIndex[depth] ?? 0;
      if (position >= groups[depth].sections.length) {
        if (depth === 0) return 'done';
        chosen.pop();
        continue;
      }

      nextIndex[depth] = position + 1;
      const section = groups[depth].sections[job.orders[depth][position]];
      if (sectionClashesWithChosen(section, chosen)) {
        // Clashing sections are ordered last, so every one after this also clashes.
        nextIndex[depth] = groups[depth].sections.length;
        this.exhaustMix(job);
        return 'evaluated';
      }

      chosen.push(section);
      nextIndex[depth + 1] = 0;
      if (depth + 1 === groups.length) {
        this.scoreChosen(job);
        return 'evaluated';
      }
      job.orders[depth + 1] = this.orderSections(groups[depth + 1].sections, chosen);
      return 'step';
    }
  }

  /**
   * Try the sections that fit the preferences best with what is already chosen
   * first, and clashing ones last, so a capped search spends its mixes on the
   * promising ones. It only reorders: an uncapped search still visits every mix.
   */
  private orderSections(sections: Course[], chosen: Course[]): number[] {
    const cost = sections.map((section) => (
      sectionClashesWithChosen(section, chosen)
        ? Number.POSITIVE_INFINITY
        : scoreMix([...chosen, section], this.prefs).score
    ));
    return sections.map((_, index) => index).sort((a, b) => cost[a] - cost[b] || a - b);
  }

  private scoreChosen(job: MixJob): void {
    const courses = job.chosen.slice();
    if (mixCreditsOk(courses, this.prefs)) {
      if (withinDailyCap(courses, this.prefs)) this.consider(courses);
      else this.overDailyCap += 1;
    }
    job.chosen.pop();
    this.exhaustMix(job);
  }

  /** Pop finished depths so a paused search resumes at the next sibling. */
  private exhaustMix(job: MixJob): void {
    const nextIndex = job.nextIndex;
    if (!nextIndex) return;
    const groups = job.groups;
    const chosen = job.chosen;
    while (true) {
      const depth = chosen.length;
      if ((nextIndex[depth] ?? 0) < groups[depth].sections.length) return;
      if (depth === 0) {
        job.done = true;
        return;
      }
      chosen.pop();
    }
  }

  private remember(buckets: Map<string, Bucket>, setKey: string, item: ScoredMix): void {
    let bucket = buckets.get(setKey);
    if (!bucket) {
      bucket = { items: [] };
      buckets.set(setKey, bucket);
    }
    if (bucket.items.some((existing) => existing.signature === item.signature)) return;
    bucket.items.push(item);
    bucket.items.sort((a, b) => a.score - b.score);
    if (bucket.items.length > 4) bucket.items.length = 4;
  }

  private consider(courses: Course[]): void {
    this.validCount += 1;
    const setKey = courses.map((course) => courseCodeKey(course.code)).sort().join('|');
    const signature = courses.map((course) => course.id).join('|');
    const { score, maxGap } = scoreMix(courses, this.prefs);
    const item = { courses, score, signature };
    const overGap = this.prefs.gapsEnabled && maxGap > this.prefs.gapLimit;
    if (overGap) this.remember(this.relaxed, setKey, item);
    else this.remember(this.buckets, setKey, item);
  }

  result(): GeneratorResult {
    const strict = rankedPlans(this.buckets);
    const gapFallback = this.prefs.gapsEnabled && strict.length === 0 && this.relaxed.size > 0;
    const chosen = gapFallback ? rankedPlans(this.relaxed) : strict;
    const gapNotice = gapFallback ? gapFallbackNotice(this.prefs.gapLimit) : null;
    const order = new Map(this.pickedOrder.map((group, index) => [group.key, index]));
    const plans = chosen.map((item) => {
      const sorted = [...item.courses].sort((a, b) => {
        return (order.get(courseCodeKey(a.code)) ?? 0) - (order.get(courseCodeKey(b.code)) ?? 0);
      });
      const chosenKeys = new Set(sorted.map((course) => courseCodeKey(course.code)));
      const pinnedCodes: string[] = [];
      const includedCodes: string[] = [];
      const skippedCodes: string[] = [];
      for (const group of this.pickedOrder) {
        if (!chosenKeys.has(group.key)) {
          skippedCodes.push(group.code);
          continue;
        }
        if (this.pinned.has(group.key)) pinnedCodes.push(group.code);
        else includedCodes.push(group.code);
      }
      const { tags } = scoreMix(sorted, this.prefs);
      const groupKey = sorted.map((course) => courseCodeKey(course.code)).sort().join('|');
      return {
        id: item.signature,
        groupKey,
        courses: sorted,
        pinnedCodes,
        includedCodes,
        skippedCodes,
        tags,
        score: item.score,
      };
    });

    let emptyReason = this.emptyReason;
    if (!emptyReason && plans.length === 0) {
      const cap = this.prefs.dailyCap;
      if (this.overDailyCap > 0 && cap != null) {
        const noun = cap === 1 ? 'course' : 'courses';
        emptyReason = this.capped
          ? `Checked ${formatCount(this.evaluated)} mixes. None stay within ${cap} ${noun} a day.`
          : `Every clash-free mix puts more than ${cap} ${noun} on one day.`;
      } else {
        emptyReason = explainEmpty(this.prepared, this.pinned, this.prefs, this.capped, this.evaluated);
      }
    }

    return {
      plans,
      evaluated: this.evaluated,
      validCount: this.validCount,
      capped: this.capped,
      estimate: this.estimate,
      emptyReason,
      dayOffNotices: plans.length > 0 ? dayOffNotices(this.prepared, this.pinned, this.prefs) : [],
      gapNotice,
      leftOut: this.leftOut,
    };
  }
}

export function startGeneratorSearch(input: GeneratorInput): GeneratorSearch {
  return new PlanSearch(input);
}

export function generatePlans(input: GeneratorInput): GeneratorResult {
  const search = startGeneratorSearch(input);
  while (!search.done) search.advance(400);
  return search.result();
}

