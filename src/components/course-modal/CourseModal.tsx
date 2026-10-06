import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Course, ClassSession, DayOfWeek, COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../../types/schedule';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import { parseBulkCourses } from '../../utils/textParser';
import { checkSessionCollision, timeToMinutes } from '../../utils/timeUtils';
import { Plus, Trash2, X } from 'lucide-react';
import { EASE_OUT, EASE_SMOOTH } from '../../utils/motion';
import { useModalBackdropHandoff, useSkipContentEnter } from '../app/DeferredDialog';
import { CourseForm } from './CourseForm';
import { QuickAddPanel } from './QuickAddPanel';
import {
  type EditableRecognizedItem,
  type MeetingPattern,
  FALLBACK_DAYS,
  DEFAULT_DURATION_MINUTES,
  endAfterStart,
  nextUnusedDay,
  patternsToSessions,
  sessionsToPatterns,
  sortDays,
  toInputTime,
} from './meetingPatterns';
import { prefixedId } from '../../utils/id';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCourseId?: string | null;
  targetPlanId?: string | null;
  initialDay?: DayOfWeek;
  initialStartTime?: string;
  initialMode?: 'form' | 'quick';
}

const CLOSE_MS = 150;

function isTabbable(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return el.getClientRects().length > 0;
}

export const CourseModal: React.FC<CourseModalProps> = (props) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {props.isOpen && <CourseModalBody {...props} />}
    </AnimatePresence>,
    document.body
  );
};

const CourseModalBody: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  editingCourseId,
  targetPlanId,
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
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      catalogCourses: state.catalogCourses,
      addCourse: state.addCourse,
      bulkAddCourses: state.bulkAddCourses,
      updateCourse: state.updateCourse,
      updateCatalogCourse: state.updateCatalogCourse,
      deleteCourse: state.deleteCourse,
      removeFromCatalog: state.removeFromCatalog,
      getNextColor: state.getNextColor,
    }))
  );
  const backdropHandoff = useModalBackdropHandoff(isOpen);
  const skipContentEnter = useSkipContentEnter(isOpen);

  const effectivePlanId = targetPlanId || activePlanId;
  const currentPlan = useMemo(
    () => plans.find((p) => p.id === effectivePlanId) || plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, effectivePlanId, activePlanId]
  );
  const isTargetGhost = effectivePlanId !== activePlanId;

  const existingCourse = useMemo(() => {
    if (!editingCourseId) return null;
    return (
      currentPlan?.courses.find((c) => c.id === editingCourseId) ||
      catalogCourses.find((c) => c.id === editingCourseId) ||
      null
    );
  }, [editingCourseId, currentPlan?.courses, catalogCourses]);

  const [mode, setMode] = useState<'form' | 'quick'>(initialMode);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shakeField, setShakeField] = useState<'code' | 'name' | 'times' | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startTimeInputRef = useRef<HTMLInputElement>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);
  const tabTrackRef = useRef<HTMLDivElement>(null);
  const formTabRef = useRef<HTMLButtonElement>(null);
  const quickTabRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState<number>(3);
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [patterns, setPatterns] = useState<MeetingPattern[]>([
    {
      id: prefixedId('p'),
      days: [initialDay],
      startTime: initialStartTime,
      endTime: endAfterStart(initialStartTime, DEFAULT_DURATION_MINUTES),
      room: '',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [rawText, setRawText] = useState('');
  const [recognizedItems, setRecognizedItems] = useState<EditableRecognizedItem[]>([]);

  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) returnFocusRef.current = active;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      const restore = returnFocusRef.current;
      if (restore && document.contains(restore)) restore.focus();
    };
  }, []);

  useEffect(() => {
    if (!rawText.trim()) {
      setRecognizedItems([]);
      return;
    }

    const timer = setTimeout(() => {
      const parsed = parseBulkCourses(rawText, currentPlan?.courses.length || 0);
      setRecognizedItems((prev) => {
        return parsed.map((res, idx) => {
          const prevItem = prev[idx];
          const stableId = prevItem?.id || `rec_${idx}`;
          const isSelected = prevItem ? prevItem.selected : true;
          const isEditing = prevItem ? prevItem.isEditing : false;

          if (res.success && res.course) {
            return {
              id: stableId,
              rawText: res.rawText,
              course: {
                ...res.course,
                id: prevItem?.course?.id || res.course.id || `c_rec_${idx}`,
              },
              selected: isSelected,
              isEditing,
            };
          }
          const fallbackCourse: Course = {
            id: prevItem?.course?.id || `c_fail_${idx}`,
            code: 'COURSE 101',
            name: res.rawText.slice(0, 40) || 'Custom Course',
            credits: 3,
            color: COURSE_COLORS[idx % COURSE_COLORS.length],
            sessions: [
              {
                id: `s_fail_${idx}`,
                day: 'monday',
                startTime: '09:00',
                endTime: '10:30',
              },
            ],
          };
          return {
            id: stableId,
            rawText: res.rawText,
            course: fallbackCourse,
            selected: false,
            isEditing,
            hasError: true,
            errorMessage: res.error || 'Check formatting',
          };
        });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [rawText, currentPlan?.courses.length]);

  const selectedCourses = useMemo(() => {
    return recognizedItems.filter((item) => item.selected && !item.hasError).map((item) => item.course);
  }, [recognizedItems]);

  const potentialConflicts = useMemo(() => {
    if (!currentPlan || selectedCourses.length === 0) return [];
    const collisionList: { newCode: string; existingCode: string; day: string; time: string }[] = [];

    selectedCourses.forEach((newC) => {
      currentPlan.courses.forEach((existC) => {
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
  }, [selectedCourses, currentPlan]);

  useEffect(() => {
    if (!isOpen) return;
    setIsConfirmingDelete(false);
    setShakeField(null);
    setRawText('');
    setRecognizedItems([]);
    if (existingCourse) {
      setMode('form');
      setCode(existingCourse.code);
      setName(existingCourse.name);
      setSection(existingCourse.section || '');
      setInstructor(existingCourse.instructor || '');
      setCredits(existingCourse.credits || 0);
      const existingNormalized = (existingCourse.color || '').toLowerCase();
      setColor(LEGACY_COURSE_COLOR_MAP[existingNormalized] || existingCourse.color);
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
      setColor(getNextColor(effectivePlanId));
      const startTime = toInputTime(initialStartTime, '09:00');
      setPatterns([
        {
          id: prefixedId('p'),
          days: [initialDay],
          startTime,
          endTime: endAfterStart(startTime, DEFAULT_DURATION_MINUTES),
          room: '',
        },
      ]);
      setDetailsOpen(false);
    }
    setError(null);
  }, [editingCourseId, isOpen, initialDay, initialStartTime, initialMode, effectivePlanId]);

  const replayShake = (field: 'code' | 'name' | 'times') => {
    setShakeField(null);
    requestAnimationFrame(() => setShakeField(field));
  };

  const switchMode = (next: 'form' | 'quick') => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    if (clipRef.current) {
      clipRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    if (mode === 'form') {
      codeInputRef.current?.focus({ preventScroll: true });
    } else {
      pasteInputRef.current?.focus({ preventScroll: true });
    }
  }, [mode]);

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
          endTime: '10:30',
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
        id: prefixedId('p'),
        days: [nextUnusedDay(used)],
        startTime: last ? last.startTime : '09:00',
        endTime: last ? last.endTime : '10:30',
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
      id: existingCourse ? existingCourse.id : prefixedId('c'),
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
        updateCourse(courseData, effectivePlanId);
      }
    } else {
      addCourse(courseData, effectivePlanId);
    }

    onClose();
  };

  const handleQuickAddSubmit = () => {
    if (selectedCourses.length === 0) {
      setError('Select at least one recognized course, or paste a syllabus line.');
      return;
    }
    bulkAddCourses(selectedCourses, effectivePlanId);
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

  const detailsSummary = [credits ? `${credits} cr` : null, section.trim() || null, instructor.trim() || null]
    .filter(Boolean)
    .join(' · ');

  const isCustomColor = !COURSE_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());

  return (
    <motion.div
      key="course-modal-overlay"
      className="fixed inset-0 z-[100] course-modal-backdrop flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 md:backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      initial={{ opacity: backdropHandoff ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: EASE_SMOOTH }}
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
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-modal-title"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full min-w-0 p-4 sm:p-5 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[min(88vh,calc(100dvh-1.5rem))] flex flex-col min-h-0 overflow-hidden will-change-transform"
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.975, y: 4 }}
        transition={{ duration: 0.24, ease: EASE_SMOOTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 id="course-modal-title" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {existingCourse ? 'Edit course' : 'Add course'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentPlan?.name || 'Active plan'}
              </p>
              {isTargetGhost && (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">
                  Comparing Plan
                </span>
              )}
            </div>
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
            className="course-tab-track relative grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl shrink-0 mt-0.5 mb-1"
            role="tablist"
            aria-label="Add course method"
          >
            <motion.span
              className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-900 shadow-sm pointer-events-none"
              animate={{
                x: mode === 'form' ? 0 : '100%',
              }}
              style={{
                left: 4,
                width: 'calc(50% - 4px)',
              }}
              transition={{ duration: 0.22, ease: EASE_SMOOTH }}
            />
            <button
              type="button"
              id="tab-mode-form"
              ref={formTabRef}
              role="tab"
              aria-selected={mode === 'form'}
              onClick={() => switchMode('form')}
              className={`relative z-10 py-2 text-sm font-semibold rounded-lg text-center transition-colors duration-150 ${
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
              className={`relative z-10 py-2 text-sm font-semibold rounded-lg text-center transition-colors duration-150 ${
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
          className="course-morph up-scroll mt-3 min-h-0 flex-auto"
        >
          <motion.div
            key={mode}
            initial={skipContentEnter ? false : { opacity: 0.2 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="w-full will-change-[opacity] transform-gpu"
          >
              {mode === 'form' ? (
                <CourseForm
                  code={code}
                  name={name}
                  section={section}
                  instructor={instructor}
                  credits={credits}
                  color={color}
                  patterns={patterns}
                  detailsOpen={detailsOpen}
                  detailsSummary={detailsSummary}
                  shakeField={shakeField}
                  isCustomColor={isCustomColor}
                  codeInputRef={codeInputRef}
                  nameInputRef={nameInputRef}
                  startTimeInputRef={startTimeInputRef}
                  onCodeChange={setCode}
                  onNameChange={setName}
                  onSectionChange={setSection}
                  onInstructorChange={setInstructor}
                  onCreditsChange={setCredits}
                  onColorChange={setColor}
                  onToggleDetails={() => setDetailsOpen((open) => !open)}
                  onSubmit={handleFormSubmit}
                  onAddPattern={addPattern}
                  onRemovePattern={removePattern}
                  onUpdatePattern={updatePattern}
                  onTogglePatternDay={togglePatternDay}
                  onApplyDayPreset={applyDayPreset}
                  onSetPatternDuration={setPatternDuration}
                />
              ) : (
                <QuickAddPanel
                  rawText={rawText}
                  recognizedItems={recognizedItems}
                  selectedCount={selectedCourses.length}
                  potentialConflicts={potentialConflicts}
                  pasteInputRef={pasteInputRef}
                  onRawTextChange={(v) => {
                    setRawText(v);
                    setError(null);
                  }}
                  onPasteClipboard={handlePasteClipboard}
                  onToggleSelect={handleToggleSelectItem}
                  onToggleEdit={handleToggleEditItem}
                  onDeleteItem={handleDeleteItem}
                  onUpdateItemCourse={handleUpdateItemCourse}
                  onUpdateItemSessionDays={handleUpdateItemSessionDays}
                  onUpdateItemTimes={handleUpdateItemTimes}
                />
              )}
            </motion.div>
        </div>

        <div className="pt-4 mt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-slate-900 min-w-0">
          {existingCourse ? (
            isConfirmingDelete ? (
              <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5 p-2 sm:p-0 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 sm:bg-transparent">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Delete this course?</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (existingCourse.id.startsWith('cat_')) {
                        removeFromCatalog(existingCourse.id);
                      } else {
                        deleteCourse(existingCourse.id, effectivePlanId);
                      }
                      onClose();
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 active:scale-[0.98]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 sm:border-transparent"
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

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-[background-color,transform] duration-[var(--dur-chrome)] text-center"
            >
              Cancel
            </button>
            {mode === 'form' ? (
              <button
                type="submit"
                form="course-build-form"
                id="btn-save-course"
                title="Save (Ctrl+Enter)"
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] transition-[background-color,transform] duration-[var(--dur-chrome)] text-center"
              >
                {existingCourse ? 'Save changes' : 'Add to Plan'}
              </button>
            ) : (
              <button
                type="button"
                id="btn-add-all-quick"
                onClick={handleQuickAddSubmit}
                disabled={selectedCourses.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-[background-color,transform,opacity] duration-[var(--dur-chrome)]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add {selectedCourses.length} course{selectedCourses.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
