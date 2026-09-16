import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Course, ClassSession, DayOfWeek, DAYS_LIST, COURSE_COLORS } from '../types/schedule';
import { useScheduleStore } from '../store/useScheduleStore';
import { parseBulkCourses } from '../utils/textParser';
import { checkSessionCollision, timeToMinutes, minutesToTime } from '../utils/timeUtils';
import {
  X,
  Plus,
  Trash2,
  Check,
  Clock,
  ClipboardPaste,
  AlertTriangle,
  Pencil,
  ChevronDown,
} from 'lucide-react';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCourseId?: string | null;
  initialDay?: DayOfWeek;
  initialStartTime?: string;
  initialMode?: 'form' | 'quick';
}

interface MeetingPattern {
  id: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  room: string;
}

interface EditableRecognizedItem {
  id: string;
  rawText: string;
  course: Course;
  selected: boolean;
  isEditing: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

const CLOSE_MS = 150;
const MORPH_MS = 250;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DAY_ORDER = DAYS_LIST.map((d) => d.id);

const DURATION_CHIPS = [
  { label: '50m', minutes: 50 },
  { label: '75m', minutes: 75 },
  { label: '90m', minutes: 90 },
] as const;

const SAMPLE_CHIPS = [
  { label: 'CS 101', text: 'CS 101 Computer science MWF 09:00-10:15' },
  { label: 'ITM 380', text: 'ITM 380 (Cloud Computing) - Sec 001, 8:30-10:00 MW, Vanndy You' },
  { label: 'COSC 340', text: 'COSC 340 (Networking Essentials) - Sec 002, 10:15-11:45 MW, Math Sa' },
] as const;

const MWF: DayOfWeek[] = ['monday', 'wednesday', 'friday'];
const TTH: DayOfWeek[] = ['tuesday', 'thursday'];

const inputClass =
  'course-input w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-0';

const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

function sortDays(days: DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function daysKey(days: DayOfWeek[]): string {
  return sortDays(days).join(',');
}

function daysEqual(a: DayOfWeek[], b: DayOfWeek[]): boolean {
  return daysKey(a) === daysKey(b);
}

function formatDaysShort(days: DayOfWeek[]): string {
  const sorted = sortDays(days);
  if (daysEqual(sorted, MWF)) return 'MWF';
  if (daysEqual(sorted, TTH)) return 'TTh';
  return sorted.map((d) => DAYS_LIST.find((x) => x.id === d)?.label ?? d).join(' ');
}

const FALLBACK_DAYS: DayOfWeek[] = ['monday'];
const LAST_MINUTE = 23 * 60 + 59;

function toInputTime(value: string, fallback: string): string {
  const trimmed = value.trim();
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  if (!trimmed) return fallback;
  const as24 = minutesToTime(timeToMinutes(trimmed), false);
  return as24 === '24:00' ? '23:59' : as24;
}

function endAfterStart(startTime: string, durationMinutes: number): string {
  const startM = timeToMinutes(startTime || '09:00');
  const endM = Math.min(LAST_MINUTE, startM + durationMinutes);
  if (endM <= startM) {
    return minutesToTime(LAST_MINUTE, false);
  }
  return minutesToTime(endM, false);
}

function isTabbable(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return el.getClientRects().length > 0;
}

function sessionsToPatterns(sessions: ClassSession[]): MeetingPattern[] {
  if (sessions.length === 0) {
    return [
      {
        id: `p_${Date.now()}`,
        days: ['monday'],
        startTime: '09:00',
        endTime: '10:15',
        room: '',
      },
    ];
  }

  const groups: MeetingPattern[] = [];
  const indexByKey = new Map<string, number>();

  for (const session of sessions) {
    const startTime = toInputTime(session.startTime, '09:00');
    const endTime = toInputTime(session.endTime, '10:15');
    const key = `${startTime}|${endTime}|${session.room || ''}`;
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      const group = groups[existing];
      if (!group.days.includes(session.day)) group.days.push(session.day);
    } else {
      indexByKey.set(key, groups.length);
      groups.push({
        id: session.id || `p_${groups.length}`,
        days: [session.day],
        startTime,
        endTime,
        room: session.room || '',
      });
    }
  }

  return groups.map((group) => ({ ...group, days: sortDays(group.days) }));
}

function patternsToSessions(patterns: MeetingPattern[]): ClassSession[] {
  return patterns.flatMap((pattern) => {
    const days = pattern.days.length > 0 ? sortDays(pattern.days) : FALLBACK_DAYS;
    const startTime = toInputTime(pattern.startTime, '09:00');
    const endTime = toInputTime(pattern.endTime, '10:15');
    return days.map((day) => ({
      id: `${pattern.id}_${day}`,
      day,
      startTime,
      endTime,
      ...(pattern.room.trim() ? { room: pattern.room.trim() } : {}),
    }));
  });
}

function nextUnusedDay(used: DayOfWeek[]): DayOfWeek {
  const weekday = DAY_ORDER.filter((d) => d !== 'saturday' && d !== 'sunday');
  return weekday.find((d) => !used.includes(d)) || 'friday';
}

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  editingCourseId,
  initialDay = 'monday',
  initialStartTime = '09:00',
  initialMode = 'form',
}) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    addCourse,
    bulkAddCourses,
    updateCourse,
    updateCatalogCourse,
    deleteCourse,
    removeFromCatalog,
    getNextColor,
  } = useScheduleStore();

  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  const existingCourse = editingCourseId
    ? activePlan?.courses.find((c) => c.id === editingCourseId) ||
      catalogCourses.find((c) => c.id === editingCourseId)
    : null;

  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<'form' | 'quick'>('form');
  const [modeDir, setModeDir] = useState<1 | -1>(1);
  const [phase, setPhase] = useState<'hidden' | 'open' | 'closing'>('hidden');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shakeField, setShakeField] = useState<'code' | 'name' | 'times' | null>(null);
  const [morphHeight, setMorphHeight] = useState<number | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startTimeInputRef = useRef<HTMLInputElement>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);
  const tabTrackRef = useRef<HTMLDivElement>(null);
  const formTabRef = useRef<HTMLButtonElement>(null);
  const quickTabRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const incomingRef = useRef<HTMLDivElement>(null);
  const morphingRef = useRef(false);
  const fromHeightRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [tabPill, setTabPill] = useState({ x: 0, w: 0, snap: true });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState<number>(3);
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [patterns, setPatterns] = useState<MeetingPattern[]>([
    {
      id: `p_${Date.now()}`,
      days: [initialDay],
      startTime: initialStartTime,
      endTime: '10:15',
      room: '',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [rawText, setRawText] = useState('');
  const [recognizedItems, setRecognizedItems] = useState<EditableRecognizedItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setPhase('open'));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    setPhase((current) => (current === 'open' ? 'closing' : current));
    const timeout = window.setTimeout(() => setPhase('hidden'), CLOSE_MS);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) returnFocusRef.current = active;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      const restore = returnFocusRef.current;
      if (restore && document.contains(restore)) restore.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!rawText.trim()) {
      setRecognizedItems([]);
      return;
    }

    const timer = setTimeout(() => {
      const parsed = parseBulkCourses(rawText, activePlan?.courses.length || 0);
      const newItems: EditableRecognizedItem[] = parsed.map((res, idx) => {
        if (res.success && res.course) {
          return {
            id: res.course.id || `rec_${idx}_${Date.now()}`,
            rawText: res.rawText,
            course: res.course,
            selected: true,
            isEditing: false,
          };
        }
        const fallbackCourse: Course = {
          id: `rec_fail_${idx}_${Date.now()}`,
          code: 'COURSE 101',
          name: res.rawText.slice(0, 40) || 'Custom Course',
          credits: 3,
          color: COURSE_COLORS[idx % COURSE_COLORS.length],
          sessions: [
            {
              id: `s_fail_${idx}`,
              day: 'monday',
              startTime: '09:00',
              endTime: '10:15',
            },
          ],
        };
        return {
          id: fallbackCourse.id,
          rawText: res.rawText,
          course: fallbackCourse,
          selected: false,
          isEditing: false,
          hasError: true,
          errorMessage: res.error || 'Check formatting',
        };
      });

      setRecognizedItems(newItems);
    }, 150);

    return () => clearTimeout(timer);
  }, [rawText, activePlan?.courses.length]);

  const selectedCourses = useMemo(() => {
    return recognizedItems.filter((item) => item.selected && !item.hasError).map((item) => item.course);
  }, [recognizedItems]);

  const potentialConflicts = useMemo(() => {
    if (!activePlan || selectedCourses.length === 0) return [];
    const collisionList: { newCode: string; existingCode: string; day: string; time: string }[] = [];

    selectedCourses.forEach((newC) => {
      activePlan.courses.forEach((existC) => {
        newC.sessions.forEach((s1) => {
          existC.sessions.forEach((s2) => {
            if (checkSessionCollision(s1, s2)) {
              collisionList.push({
                newCode: newC.code,
                existingCode: existC.code,
                day: s1.day,
                time: `${s1.startTime} - ${s1.endTime}`,
              });
            }
          });
        });
      });
    });

    return collisionList;
  }, [selectedCourses, activePlan]);

  useLayoutEffect(() => {
    if (existingCourse || phase === 'hidden') return;
    const track = tabTrackRef.current;
    const activeEl = mode === 'form' ? formTabRef.current : quickTabRef.current;
    if (!track || !activeEl) return;

    const trackBox = track.getBoundingClientRect();
    const tabBox = activeEl.getBoundingClientRect();
    setTabPill((prev) => ({
      x: tabBox.left - trackBox.left,
      w: tabBox.width,
      snap: prev.w === 0,
    }));
  }, [mode, phase, existingCourse]);

  useEffect(() => {
    if (!tabPill.snap || tabPill.w === 0) return;
    const id = requestAnimationFrame(() => {
      setTabPill((prev) => ({ ...prev, snap: false }));
    });
    return () => cancelAnimationFrame(id);
  }, [tabPill.snap, tabPill.w]);

  useEffect(() => {
    if (!isOpen) return;
    setIsConfirmingDelete(false);
    setMorphHeight(null);
    morphingRef.current = false;
    setShakeField(null);
    setRawText('');
    setRecognizedItems([]);
    setTabPill({ x: 0, w: 0, snap: true });
    if (existingCourse) {
      setMode('form');
      setCode(existingCourse.code);
      setName(existingCourse.name);
      setSection(existingCourse.section || '');
      setInstructor(existingCourse.instructor || '');
      setCredits(existingCourse.credits || 0);
      setColor(existingCourse.color);
      setPatterns(sessionsToPatterns(existingCourse.sessions));
      setDetailsOpen(
        Boolean(existingCourse.section || existingCourse.instructor || (existingCourse.credits && existingCourse.credits !== 3))
      );
    } else {
      setMode(initialMode);
      setCode('');
      setName('');
      setSection('');
      setInstructor('');
      setCredits(3);
      setColor(getNextColor(activePlanId));
      const startTime = toInputTime(initialStartTime, '09:00');
      setPatterns([
        {
          id: `p_${Date.now()}`,
          days: [initialDay],
          startTime,
          endTime: endAfterStart(startTime, 75),
          room: '',
        },
      ]);
      setDetailsOpen(false);
    }
    setError(null);
  }, [existingCourse, isOpen, initialDay, initialStartTime, initialMode, activePlanId, getNextColor]);

  const replayShake = (field: 'code' | 'name' | 'times') => {
    setShakeField(null);
    requestAnimationFrame(() => setShakeField(field));
  };

  const switchMode = (next: 'form' | 'quick') => {
    if (next === mode) return;
    fromHeightRef.current = clipRef.current?.offsetHeight ?? 0;
    morphingRef.current = true;
    setMorphHeight(fromHeightRef.current);
    setModeDir(next === 'quick' ? 1 : -1);
    setMode(next);
    setError(null);
  };

  useLayoutEffect(() => {
    const clip = clipRef.current;
    if (!morphingRef.current || !clip) return;

    if (reduceMotion) {
      morphingRef.current = false;
      clip.style.height = '';
      setMorphHeight(null);
      return;
    }

    const incoming = incomingRef.current;
    const sheet = sheetRef.current;
    const natural = incoming?.offsetHeight ?? fromHeightRef.current;
    const chrome = sheet ? sheet.offsetHeight - fromHeightRef.current : 0;
    const maxSheet = Math.round(window.innerHeight * 0.88);
    const maxClip = Math.max(120, maxSheet - chrome);
    const to = Math.min(natural, maxClip);

    clip.style.height = `${fromHeightRef.current}px`;
    void clip.offsetHeight;
    clip.style.height = `${to}px`;
    setMorphHeight(to);

    const timeout = window.setTimeout(() => {
      morphingRef.current = false;
      clip.style.height = '';
      setMorphHeight(null);
    }, MORPH_MS);

    return () => window.clearTimeout(timeout);
  }, [mode, reduceMotion]);

  useEffect(() => {
    if (phase !== 'open') return;
    if (mode === 'form') {
      codeInputRef.current?.focus();
    } else {
      pasteInputRef.current?.focus();
    }
  }, [mode, phase]);

  const handleToggleSelectItem = (id: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleToggleEditItem = (id: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: !item.isEditing } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setRecognizedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemCourse = (id: string, updates: Partial<Course>) => {
    setRecognizedItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              hasError: false,
              selected: true,
              course: { ...item.course, ...updates },
            }
          : item
      )
    );
  };

  const handleUpdateItemSessionDays = (id: string, days: DayOfWeek[]) => {
    setRecognizedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const baseSession = item.course.sessions[0] || {
          startTime: '09:00',
          endTime: '10:15',
          room: '',
        };
        const newDays = days.length > 0 ? days : FALLBACK_DAYS;
        const newSessions: ClassSession[] = newDays.map((d, idx) => ({
          id: `s_${item.id}_${idx}`,
          day: d,
          startTime: baseSession.startTime,
          endTime: baseSession.endTime,
          room: baseSession.room,
        }));
        return {
          ...item,
          hasError: false,
          selected: true,
          course: { ...item.course, sessions: newSessions },
        };
      })
    );
  };

  const handleUpdateItemTimes = (id: string, startTime: string, endTime: string) => {
    setRecognizedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          hasError: false,
          selected: true,
          course: {
            ...item.course,
            sessions: item.course.sessions.map((s) => ({
              ...s,
              startTime: toInputTime(startTime || s.startTime, s.startTime),
              endTime: toInputTime(endTime || s.endTime, s.endTime),
            })),
          },
        };
      })
    );
  };

  const updatePattern = (index: number, patch: Partial<MeetingPattern>) => {
    setPatterns((prev) => prev.map((pattern, i) => (i === index ? { ...pattern, ...patch } : pattern)));
    setError(null);
  };

  const togglePatternDay = (index: number, day: DayOfWeek) => {
    setPatterns((prev) =>
      prev.map((pattern, i) => {
        if (i !== index) return pattern;
        const has = pattern.days.includes(day);
        if (has && pattern.days.length === 1) return pattern;
        const days = has ? pattern.days.filter((d) => d !== day) : sortDays([...pattern.days, day]);
        return { ...pattern, days };
      })
    );
  };

  const applyDayPreset = (index: number, preset: DayOfWeek[]) => {
    updatePattern(index, { days: [...preset] });
  };

  const addPattern = () => {
    const last = patterns[patterns.length - 1];
    const used = patterns.flatMap((p) => p.days);
    setPatterns((prev) => [
      ...prev,
      {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        days: [nextUnusedDay(used)],
        startTime: last ? last.startTime : '09:00',
        endTime: last ? last.endTime : '10:15',
        room: last ? last.room : '',
      },
    ]);
  };

  const removePattern = (index: number) => {
    if (patterns.length <= 1) {
      setError('A course needs at least one meeting time.');
      replayShake('times');
      return;
    }
    setPatterns((prev) => prev.filter((_, i) => i !== index));
  };

  const setPatternDuration = (index: number, durationMinutes: number) => {
    setPatterns((prev) =>
      prev.map((pattern, i) => {
        if (i !== index) return pattern;
        return { ...pattern, endTime: endAfterStart(pattern.startTime || '09:00', durationMinutes) };
      })
    );
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setError('Course code is required (e.g. CS 101).');
      replayShake('code');
      codeInputRef.current?.focus();
      return;
    }
    if (!trimmedName) {
      setError('Course title is required.');
      replayShake('name');
      nameInputRef.current?.focus();
      return;
    }

    const sessions = patternsToSessions(patterns);
    if (sessions.length === 0) {
      setError('Pick at least one meeting day.');
      replayShake('times');
      return;
    }

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const startTime = toInputTime(pattern.startTime, '');
      const endTime = toInputTime(pattern.endTime, '');
      if (!startTime || !endTime) {
        setError(`Meeting ${i + 1}: start and end times are required.`);
        replayShake('times');
        return;
      }
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        setError(`Meeting ${i + 1}: start must be before end.`);
        replayShake('times');
        return;
      }
    }

    const courseData: Course = {
      id: existingCourse ? existingCourse.id : `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: trimmedCode,
      name: trimmedName,
      section: section.trim() || undefined,
      instructor: instructor.trim() || undefined,
      credits: Number(credits) || 0,
      color,
      sessions,
    };

    if (existingCourse) {
      if (existingCourse.id.startsWith('cat_')) {
        updateCatalogCourse(courseData);
      } else {
        updateCourse(courseData, activePlanId);
      }
    } else {
      addCourse(courseData, activePlanId);
    }

    onClose();
  };

  const handleQuickAddSubmit = () => {
    if (selectedCourses.length === 0) {
      setError('Select at least one recognized course, or paste a syllabus line.');
      return;
    }
    bulkAddCourses(selectedCourses, activePlanId);
    onClose();
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev.trim() ? `${prev}\n${text}` : text));
        pasteInputRef.current?.focus();
      }
    } catch {
      pasteInputRef.current?.focus();
    }
  };

  if (phase === 'hidden' && !isOpen) return null;

  const phaseClass = phase === 'open' ? 'is-open' : phase === 'closing' ? 'is-closing' : '';
  const detailsSummary = [credits ? `${credits} cr` : null, section.trim() || null, instructor.trim() || null]
    .filter(Boolean)
    .join(' · ');

  const isCustomColor = !COURSE_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());

  return (
    <div
      className={`course-modal-backdrop ${phaseClass} fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/55 overflow-x-hidden overflow-y-auto`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (mode === 'form') handleFormSubmit();
          else handleQuickAddSubmit();
          return;
        }
        if (e.key !== 'Tab') return;
        const root = sheetRef.current;
        if (!root) return;
        const nodes = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(isTabbable);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-modal-title"
        className={`course-modal-sheet ${phaseClass} bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_8px_rgb(15_23_42_/_0.18)] max-w-lg w-full p-4 sm:p-5 my-auto max-h-[calc(100svh-1.5rem)] sm:max-h-[min(88vh,calc(100dvh-1.5rem))] flex flex-col min-h-0 overflow-hidden`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 id="course-modal-title" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {existingCourse ? 'Edit course' : 'Add course'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {activePlan?.name || 'Active plan'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-[var(--dur-chrome)] ease-[var(--ease-snap)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!existingCourse && (
          <div
            ref={tabTrackRef}
            className="course-tab-track mt-0.5 mb-1 flex p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl shrink-0"
            role="tablist"
            aria-label="Add course method"
          >
            <span
              className={`course-tab-pill ${tabPill.snap ? 'is-snap' : ''}`}
              style={
                {
                  '--tabs-x': `${tabPill.x}px`,
                  '--tabs-w': `${tabPill.w}px`,
                } as React.CSSProperties
              }
            />
            <button
              type="button"
              id="tab-mode-form"
              ref={formTabRef}
              role="tab"
              aria-selected={mode === 'form'}
              onClick={() => switchMode('form')}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-[var(--dur-chrome)] ${
                mode === 'form'
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Build
            </button>
            <button
              type="button"
              id="tab-mode-quick"
              ref={quickTabRef}
              role="tab"
              aria-selected={mode === 'quick'}
              onClick={() => switchMode('quick')}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-[var(--dur-chrome)] ${
                mode === 'quick'
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Paste
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs shrink-0"
          >
            {error}
          </div>
        )}

        <div
          ref={clipRef}
          className={`course-morph up-scroll mt-3 min-h-0 flex-auto ${morphHeight !== null ? 'is-morphing' : ''}`}
          style={morphHeight !== null ? { height: morphHeight } : undefined}
        >
          <AnimatePresence initial={false} mode="sync">
            {mode === 'form' ? (
              <motion.div
                key="form"
                className="min-h-0"
                initial={reduceMotion ? false : { opacity: 0, x: modeDir * 8, filter: 'blur(3px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        x: modeDir * -8,
                        filter: 'blur(3px)',
                        position: 'absolute',
                        width: '100%',
                        top: 0,
                        left: 0,
                      }
                }
                transition={{
                  duration: reduceMotion ? 0 : MORPH_MS / 1000,
                  ease: EASE_OUT,
                  opacity: { duration: reduceMotion ? 0 : CLOSE_MS / 1000 },
                }}
              >
                <div ref={incomingRef}>
                <form
                  id="course-build-form"
                  onSubmit={handleFormSubmit}
                  className="space-y-4 pr-0.5"
                >
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-4 min-w-0">
                  <label htmlFor="course-code" className={labelClass}>
                    Code
                  </label>
                  <input
                    id="course-code"
                    ref={codeInputRef}
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nameInputRef.current?.focus();
                      }
                    }}
                    placeholder="e.g. CS 101"
                    required
                    autoComplete="off"
                    className={`${inputClass} font-mono font-semibold course-field ${
                      shakeField === 'code' ? 'is-error is-shaking' : ''
                    }`}
                  />
                </div>
                <div className="col-span-8 min-w-0">
                  <label htmlFor="course-title" className={labelClass}>
                    Title
                  </label>
                  <input
                    id="course-title"
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        startTimeInputRef.current?.focus();
                      }
                    }}
                    placeholder="Intro to CS"
                    required
                    className={`${inputClass} course-field ${shakeField === 'name' ? 'is-error is-shaking' : ''}`}
                  />
                </div>
              </div>

              <div className={shakeField === 'times' ? 'course-field is-shaking rounded-lg' : ''}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    When
                  </span>
                  <button
                    type="button"
                    onClick={addPattern}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Different time
                  </button>
                </div>

                <div className="space-y-2.5">
                  {patterns.map((pattern, index) => {
                    const duration = timeToMinutes(pattern.endTime) - timeToMinutes(pattern.startTime);
                    return (
                      <div
                        key={pattern.id}
                        className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => applyDayPreset(index, MWF)}
                              className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors duration-[var(--dur-chrome)] ${
                                daysEqual(pattern.days, MWF)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              MWF
                            </button>
                            <button
                              type="button"
                              onClick={() => applyDayPreset(index, TTH)}
                              className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors duration-[var(--dur-chrome)] ${
                                daysEqual(pattern.days, TTH)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              TTh
                            </button>
                          </div>
                          {patterns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePattern(index)}
                              className="p-1 text-slate-400 hover:text-rose-500"
                              aria-label="Remove this meeting time"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex gap-1" role="group" aria-label="Meeting days">
                          {DAYS_LIST.map((d) => {
                            const on = pattern.days.includes(d.id);
                            const weekend = d.id === 'saturday' || d.id === 'sunday';
                            return (
                              <button
                                key={d.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => togglePatternDay(index, d.id)}
                                className={`course-day flex-1 rounded-md text-[11px] font-semibold ${
                                  on
                                    ? 'bg-indigo-600 text-white'
                                    : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 ${
                                        weekend ? 'opacity-70' : ''
                                      }`
                                }`}
                              >
                                {d.short === 'TH' ? 'Th' : d.short === 'SA' ? 'Sa' : d.short === 'SU' ? 'Su' : d.short}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4 min-w-0">
                            <label className="sr-only" htmlFor={index === 0 ? 'course-start' : `meeting-start-${pattern.id}`}>
                              Start time
                            </label>
                            <input
                              id={index === 0 ? 'course-start' : `meeting-start-${pattern.id}`}
                              ref={index === 0 ? startTimeInputRef : undefined}
                              type="time"
                              required
                              value={pattern.startTime}
                              onChange={(e) => {
                                const startTime = e.target.value;
                                const endM = timeToMinutes(pattern.endTime);
                                const startM = timeToMinutes(startTime);
                                updatePattern(index, {
                                  startTime,
                                  endTime: endM <= startM ? endAfterStart(startTime, 75) : pattern.endTime,
                                });
                              }}
                              className={`${inputClass} font-mono`}
                            />
                          </div>
                          <div className="col-span-4 min-w-0">
                            <label className="sr-only" htmlFor={`meeting-end-${pattern.id}`}>
                              End time
                            </label>
                            <input
                              id={`meeting-end-${pattern.id}`}
                              type="time"
                              required
                              value={pattern.endTime}
                              onChange={(e) => updatePattern(index, { endTime: e.target.value })}
                              className={`${inputClass} font-mono`}
                            />
                          </div>
                          <div className="col-span-4 min-w-0">
                            <label className="sr-only" htmlFor={`meeting-room-${pattern.id}`}>
                              Room
                            </label>
                            <input
                              id={`meeting-room-${pattern.id}`}
                              type="text"
                              value={pattern.room}
                              onChange={(e) => updatePattern(index, { room: e.target.value })}
                              placeholder="Room"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {formatDaysShort(pattern.days)} {pattern.startTime}-{pattern.endTime}
                            {pattern.room.trim() ? ` · ${pattern.room.trim()}` : ''}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {DURATION_CHIPS.map((chip) => (
                              <button
                                key={chip.label}
                                type="button"
                                onClick={() => setPatternDuration(index, chip.minutes)}
                                className={`px-2 py-0.5 text-[11px] font-mono rounded-md transition-colors duration-[var(--dur-chrome)] ${
                                  duration === chip.minutes
                                    ? 'bg-indigo-600 text-white font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className="course-acc-trigger w-full flex items-center justify-between gap-2 py-1 text-left"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Details</span>
                  <span className="flex items-center gap-2 min-w-0">
                    {!detailsOpen && detailsSummary && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detailsSummary}</span>
                    )}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <ChevronDown className="course-acc-chevron w-4 h-4 text-slate-400" />
                  </span>
                </button>
                <div className={`course-acc ${detailsOpen ? 'is-open' : ''}`} inert={!detailsOpen}>
                  <div className="course-acc-inner">
                    <div className="course-acc-body pt-2 pb-2 space-y-3">
                      <div className="grid grid-cols-12 gap-2.5">
                        <div className="col-span-3 min-w-0">
                          <label htmlFor="course-credits" className={labelClass}>
                            Credits
                          </label>
                          <input
                            id="course-credits"
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={credits}
                            onChange={(e) => setCredits(parseFloat(e.target.value) || 0)}
                            className={`${inputClass} font-mono`}
                          />
                        </div>
                        <div className="col-span-4 min-w-0">
                          <label htmlFor="course-section" className={labelClass}>
                            Section
                          </label>
                          <input
                            id="course-section"
                            type="text"
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            placeholder="01"
                            className={`${inputClass} font-mono`}
                          />
                        </div>
                        <div className="col-span-5 min-w-0">
                          <label htmlFor="course-instructor" className={labelClass}>
                            Instructor
                          </label>
                          <input
                            id="course-instructor"
                            type="text"
                            value={instructor}
                            onChange={(e) => setInstructor(e.target.value)}
                            placeholder="Name"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <span className={labelClass}>Color</span>
                        <div className="flex items-center gap-2 flex-wrap px-2 py-2">
                          {COURSE_COLORS.map((swatch) => {
                            const selected = color.toLowerCase() === swatch.toLowerCase();
                            return (
                              <button
                                key={swatch}
                                type="button"
                                aria-label={`Use color ${swatch}`}
                                aria-pressed={selected}
                                onClick={() => setColor(swatch)}
                                className={`course-swatch w-6 h-6 rounded-full flex items-center justify-center ${
                                  selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                                }`}
                                style={{ backgroundColor: swatch }}
                              >
                                {selected && <Check className="w-3 h-3 text-white" />}
                              </button>
                            );
                          })}
                          <label
                            title="Custom color"
                            className={`course-swatch relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
                              isCustomColor
                                ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                                : 'border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                            style={isCustomColor ? { backgroundColor: color } : undefined}
                          >
                            <input
                              type="color"
                              tabIndex={-1}
                              value={color.startsWith('#') && color.length === 7 ? color : '#6366F1'}
                              onChange={(e) => setColor(e.target.value)}
                              className="sr-only"
                              id="custom-course-color-mixer"
                            />
                            {isCustomColor ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <Plus className="w-3 h-3 text-slate-500" />
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                </form>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="quick"
                className="min-h-0"
                initial={reduceMotion ? false : { opacity: 0, x: modeDir * 8, filter: 'blur(3px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        x: modeDir * -8,
                        filter: 'blur(3px)',
                        position: 'absolute',
                        width: '100%',
                        top: 0,
                        left: 0,
                      }
                }
                transition={{
                  duration: reduceMotion ? 0 : MORPH_MS / 1000,
                  ease: EASE_OUT,
                  opacity: { duration: reduceMotion ? 0 : CLOSE_MS / 1000 },
                }}
              >
            <div ref={incomingRef} className="space-y-3 pr-0.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="course-paste" className={labelClass + ' mb-0'}>
                    One course per line
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {rawText.split('\n').filter((l) => l.trim().length > 0).length || 0} lines
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    id="course-paste"
                    ref={pasteInputRef}
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setError(null);
                    }}
                    rows={5}
                    placeholder={'CS 101 Computer science MWF 09:00-10:15\nITM 380 Cloud Computing MW 8:30-10:00'}
                    className={`${inputClass} min-h-32 resize-none font-mono text-[13px] leading-relaxed pr-24`}
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    Paste
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400">Examples</span>
                  {SAMPLE_CHIPS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => setRawText((prev) => (prev.trim() ? `${prev}\n${sample.text}` : sample.text))}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              {recognizedItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {selectedCourses.length} ready
                    </span>
                    {potentialConflicts.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-3 h-3" />
                        {potentialConflicts.length} overlap{potentialConflicts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {recognizedItems.map((item, idx) => {
                      const c = item.course;
                      const session0 = c.sessions[0] || {
                        startTime: '09:00',
                        endTime: '10:15',
                        day: 'monday' as DayOfWeek,
                      };
                      const currentDays = c.sessions.map((s) => s.day);
                      const duration = timeToMinutes(session0.endTime) - timeToMinutes(session0.startTime);

                      return (
                        <div
                          key={item.id}
                          className={`course-row rounded-lg border ${
                            item.hasError
                              ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                              : item.selected
                                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                : 'bg-transparent border-slate-200/80 dark:border-slate-800 opacity-60'
                          }`}
                          style={{ ['--i' as string]: Math.min(idx, 7) }}
                        >
                          <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleSelectItem(item.id)}
                                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus-visible:ring-indigo-500"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-semibold text-xs text-slate-900 dark:text-white">
                                    {c.code}
                                  </span>
                                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{c.name}</span>
                                </span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                  {formatDaysShort(currentDays)} {session0.startTime}-{session0.endTime}
                                  {item.hasError ? ` · ${item.errorMessage}` : ''}
                                </span>
                              </span>
                            </label>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleEditItem(item.id)}
                                className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 ${
                                  item.isEditing ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600' : ''
                                }`}
                                aria-label={item.isEditing ? 'Collapse course' : 'Edit course'}
                              >
                                {item.hasError ? (
                                  <span className="px-1.5 text-[11px] font-semibold text-rose-600">Fix</span>
                                ) : (
                                  <Pencil className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                                aria-label="Discard this course"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className={`course-acc ${item.isEditing ? 'is-open' : ''}`} inert={!item.isEditing}>
                            <div className="course-acc-inner">
                              <div className="course-acc-body px-2.5 pb-2.5 space-y-2.5 border-t border-slate-200/80 dark:border-slate-700 pt-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className={labelClass}>Code</label>
                                    <input
                                      type="text"
                                      value={c.code}
                                      onChange={(e) =>
                                        handleUpdateItemCourse(item.id, { code: e.target.value.toUpperCase() })
                                      }
                                      className={`${inputClass} font-mono font-semibold`}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Title</label>
                                    <input
                                      type="text"
                                      value={c.name}
                                      onChange={(e) => handleUpdateItemCourse(item.id, { name: e.target.value })}
                                      className={inputClass}
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-1" role="group" aria-label="Meeting days">
                                  {DAYS_LIST.map((d) => {
                                    const isSelected = currentDays.includes(d.id);
                                    return (
                                      <button
                                        key={d.id}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                          const newDays = isSelected
                                            ? currentDays.filter((cd) => cd !== d.id)
                                            : [...currentDays, d.id];
                                          handleUpdateItemSessionDays(item.id, newDays);
                                        }}
                                        className={`course-day flex-1 rounded-md text-[11px] font-semibold ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        {d.short === 'TH' ? 'Th' : d.short === 'SA' ? 'Sa' : d.short === 'SU' ? 'Su' : d.short}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <input
                                    type="time"
                                    aria-label="Start time"
                                    value={session0.startTime}
                                    onChange={(e) =>
                                      handleUpdateItemTimes(item.id, e.target.value, session0.endTime)
                                    }
                                    className={`${inputClass} font-mono`}
                                  />
                                  <input
                                    type="time"
                                    aria-label="End time"
                                    value={session0.endTime}
                                    onChange={(e) =>
                                      handleUpdateItemTimes(item.id, session0.startTime, e.target.value)
                                    }
                                    className={`${inputClass} font-mono`}
                                  />
                                  <input
                                    type="text"
                                    aria-label="Section"
                                    value={c.section || ''}
                                    onChange={(e) => handleUpdateItemCourse(item.id, { section: e.target.value })}
                                    placeholder="Section"
                                    className={`${inputClass} font-mono`}
                                  />
                                  <input
                                    type="text"
                                    aria-label="Instructor"
                                    value={c.instructor || ''}
                                    onChange={(e) => handleUpdateItemCourse(item.id, { instructor: e.target.value })}
                                    placeholder="Instructor"
                                    className={inputClass}
                                  />
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    {DURATION_CHIPS.map((chip) => (
                                      <button
                                        key={chip.label}
                                        type="button"
                                        onClick={() => {
                                          handleUpdateItemTimes(
                                            item.id,
                                            session0.startTime,
                                            endAfterStart(session0.startTime || '09:00', chip.minutes)
                                          );
                                        }}
                                        className={`px-2 py-0.5 text-[11px] font-mono rounded-md ${
                                          duration === chip.minutes
                                            ? 'bg-indigo-600 text-white font-semibold'
                                            : 'text-slate-500 hover:text-indigo-600'
                                        }`}
                                      >
                                        {chip.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleEditItem(item.id)}
                                    className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-4 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          {existingCourse ? (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Delete this course?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (existingCourse.id.startsWith('cat_')) {
                      removeFromCatalog(existingCourse.id);
                    } else {
                      deleteCourse(existingCourse.id, activePlanId);
                    }
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )
          ) : (
            <p className="text-[11px] text-slate-400 hidden sm:block">
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">
                Ctrl+Enter
              </kbd>
            </p>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-[background-color,transform] duration-[var(--dur-chrome)]"
            >
              Cancel
            </button>
            {mode === 'form' ? (
              <button
                type="submit"
                form="course-build-form"
                id="btn-save-course"
                title="Save (Ctrl+Enter)"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] transition-[background-color,transform] duration-[var(--dur-chrome)]"
              >
                {existingCourse ? 'Save changes' : 'Add to Plan'}
              </button>
            ) : (
              <button
                type="button"
                id="btn-add-all-quick"
                onClick={handleQuickAddSubmit}
                disabled={selectedCourses.length === 0}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white inline-flex items-center gap-1.5 active:scale-[0.98] transition-[background-color,transform,opacity] duration-[var(--dur-chrome)]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add {selectedCourses.length} course{selectedCourses.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
