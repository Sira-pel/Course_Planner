import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SchedulePlan } from '../types/schedule';
import { resolveInitialTheme } from '../utils/theme';
import { createCatalogSlice } from './catalogSlice';
import { createCourseSlice } from './courseSlice';
import { createHistorySlice } from './history';
import { DEFAULT_SEMESTER_END, DEFAULT_SEMESTER_START, persistOptions } from './persist';
import { createPlanSlice } from './planSlice';
import { createPrefsSlice } from './prefsSlice';
import type { ScheduleState } from './types';

export const DEFAULT_INITIAL_PLANS: SchedulePlan[] = [
  {
    id: 'plan_1',
    name: 'Plan A',
    courses: [],
  },
];

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      plans: DEFAULT_INITIAL_PLANS,
      activePlanId: 'plan_1',
      ghostPlanIds: [],
      catalogCourses: [],
      showWeekends: false,
      startHour: 7,
      endHour: 17,
      theme: resolveInitialTheme(),
      semesterStart: DEFAULT_SEMESTER_START,
      semesterEnd: DEFAULT_SEMESTER_END,
      past: [],
      future: [],
      ...createPlanSlice(set, get),
      ...createCourseSlice(set, get),
      ...createCatalogSlice(set, get),
      ...createHistorySlice(set, get),
      ...createPrefsSlice(set, get),
    }),
    persistOptions
  )
);
