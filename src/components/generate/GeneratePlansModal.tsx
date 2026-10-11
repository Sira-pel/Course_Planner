import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { ChevronLeft, ChevronRight, Shuffle, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useScheduleStore } from '../../store/useScheduleStore';
import { prefixedId } from '../../utils/id';
import {
  loadGeneratorPrefs,
  saveGeneratorPrefs,
  type StoredGeneratorPrefs,
} from '../../utils/generatorPrefs';
import {
  SHEET_CLOSE_TRANSITION,
  SHEET_OPEN_TRANSITION,
  useModalMotion,
} from '../../utils/motion';
import { useIsPhone } from '../../utils/usePoolLayout';
import { timeToMinutes } from '../../utils/timeUtils';
import {
  creditBounds,
  groupCoursesByCode,
  MAX_CANDIDATES,
  nextGeneratedPlanName,
  startGeneratorSearch,
  type CourseGroup,
  type GeneratedPlan,
  type GeneratorResult,
  type GeneratorSearch,
} from '../../utils/planGenerator';
import { AnimatedBody } from '../app/AnimatedBody';
import { CoursesStep } from './CoursesStep';
import { GenerateStepHeader } from './GenerateStepHeader';
import { PreferencesStep, type BlockedDraft } from './PreferencesStep';
import { ResultsStep } from './ResultsStep';

interface GeneratePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (name: string) => void;
}

function matchesQuery(group: CourseGroup, query: string): boolean {
  if (!query) return true;
  const haystack = [
    group.code,
    group.name,
    ...group.sections.flatMap((section) => [section.section, section.instructor, section.name]),
  ].join(' ').toLowerCase();
  return haystack.includes(query);
}

function groupCredits(group: CourseGroup): { min: number; max: number } {
  const credits = group.sections.map((section) => (
    typeof section.credits === 'number' && Number.isFinite(section.credits) ? section.credits : 0
  ));
  if (credits.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...credits), max: Math.max(...credits) };
}

export const GeneratePlansModal: React.FC<GeneratePlansModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const { backdropProps, panelProps, contentProps } = useModalMotion(isOpen);
  const { catalogCourses, createPlan, bulkAddCourses, planNames } = useScheduleStore(
    useShallow((state) => ({
      catalogCourses: state.catalogCourses,
      createPlan: state.createPlan,
      bulkAddCourses: state.bulkAddCourses,
      planNames: state.plans.map((plan) => plan.name),
    })),
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [prefs, setPrefs] = useState<StoredGeneratorPrefs>(() => loadGeneratorPrefs());
  const [moreOpen, setMoreOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedDraft[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(0);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Record<string, string>>({});
  const blockSeq = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);

  const groups = useMemo(() => groupCoursesByCode(catalogCourses), [catalogCourses]);
  const filteredGroups = useMemo(
    () => groups.filter((group) => matchesQuery(group, query.trim().toLowerCase())),
    [groups, query],
  );
  const pickedGroups = useMemo(
    () => groups.filter((group) => picked.has(group.key)),
    [groups, picked],
  );

  const courseMin = Math.max(2, pinned.size);
  const courseMax = Math.max(courseMin, picked.size);
  const courseCount = Math.min(courseMax, Math.max(courseMin, prefs.courseCount));
  const pinnedCreditMin = pickedGroups
    .filter((group) => pinned.has(group.key))
    .reduce((sum, group) => sum + groupCredits(group).min, 0);
  const pickedCreditMax = pickedGroups.reduce((sum, group) => sum + groupCredits(group).max, 0);
  const creditMinBound = Math.max(pinnedCreditMin, 1);
  const creditMaxBound = Math.max(pickedCreditMax, creditMinBound);
  const creditTarget = Math.min(creditMaxBound, Math.max(creditMinBound, prefs.creditTarget));
  const creditWindow = creditBounds(creditTarget, pinnedCreditMin);
  const creditWindowLabel = creditWindow.min === creditWindow.max
    ? `Plans totaling ${creditWindow.max} credits`
    : `Plans between ${creditWindow.min} and ${creditWindow.max} credits`;

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.();
    cancelRef.current = null;
    setStep(1);
    setQuery('');
    setPicked(new Set());
    setPinned(new Set());
    setPrefs(loadGeneratorPrefs());
    setMoreOpen(false);
    setBlocked([]);
    setLockedIds([]);
    setExcludedIds([]);
    setRunning(false);
    setChecked(0);
    setResult(null);
    setPreviewId(null);
    setSavedNames({});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isPhone || !isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, isOpen]);

  useEffect(() => () => cancelRef.current?.(), []);

  const patchPrefs = (patch: Partial<StoredGeneratorPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveGeneratorPrefs(next);
      return next;
    });
    setResult(null);
  };

  const togglePicked = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setPinned((pins) => {
          if (!pins.has(key)) return pins;
          const copy = new Set(pins);
          copy.delete(key);
          return copy;
        });
      } else if (next.size < MAX_CANDIDATES) {
        next.add(key);
      }
      return next;
    });
    setResult(null);
  };

  const togglePin = (key: string) => {
    setResult(null);
    if (pinned.has(key)) {
      setPinned((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    if (!picked.has(key) && picked.size >= MAX_CANDIDATES) return;
    if (!picked.has(key)) {
      setPicked((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
    setPinned((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const visible = filteredGroups.map((group) => group.key);
    const allOn = visible.length > 0 && visible.every((key) => picked.has(key));
    setResult(null);
    if (allOn) {
      setPicked((prev) => {
        const next = new Set(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      setPinned((prev) => {
        const next = new Set(prev);
        for (const key of visible) next.delete(key);
        return next;
      });
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      for (const key of visible) {
        if (next.size >= MAX_CANDIDATES) break;
        next.add(key);
      }
      return next;
    });
  };

  const pickedSectionIds = useMemo(
    () => new Set(pickedGroups.flatMap((group) => group.sections.map((section) => section.id))),
    [pickedGroups],
  );

  useEffect(() => {
    setLockedIds((prev) => {
      const next = prev.filter((id) => pickedSectionIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    setExcludedIds((prev) => {
      const next = prev.filter((id) => pickedSectionIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [pickedSectionIds]);

  const stopSearch = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRunning(false);
  };

  const handleGenerate = () => {
    stopSearch();
    setStep(3);
    setPreviewId(null);
    setSavedNames({});
    setChecked(0);
    setResult(null);
    setRunning(true);

    const lunchStart = timeToMinutes(prefs.lunchStart);
    const lunchEnd = timeToMinutes(prefs.lunchEnd);
    const classStart = prefs.classStart ? timeToMinutes(prefs.classStart) : null;
    const classEnd = prefs.classEnd ? timeToMinutes(prefs.classEnd) : null;
    const search: GeneratorSearch = startGeneratorSearch({
      groups: pickedGroups,
      pinnedKeys: [...pinned],
      preferences: {
        mode: prefs.mode,
        courseCount,
        creditMin: creditWindow.min,
        creditMax: creditWindow.max,
        gapsEnabled: prefs.gapsEnabled,
        gapLimit: prefs.gapLimit,
        lunchEnabled: prefs.lunchEnabled,
        lunchStart,
        lunchEnd,
        lunchMinutes: 45,
        daysOff: prefs.daysOff,
        classStart,
        classEnd,
        blocked: blocked.map((block) => ({
          day: block.day,
          startMinutes: timeToMinutes(block.start),
          endMinutes: timeToMinutes(block.end),
        })),
        lockedSectionIds: lockedIds,
        excludedSectionIds: excludedIds,
      },
    });

    let timer = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const started = performance.now();
      while (!search.done && performance.now() - started < 12) search.advance(60);
      if (cancelled) return;
      if (search.done) {
        setChecked(search.evaluated);
        setResult(search.result());
        setRunning(false);
        cancelRef.current = null;
        return;
      }
      setChecked(search.evaluated);
      timer = window.setTimeout(tick, 0);
    };
    cancelRef.current = () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    timer = window.setTimeout(tick, 0);
  };

  const handleSave = (plan: GeneratedPlan) => {
    const name = nextGeneratedPlanName(useScheduleStore.getState().plans);
    const planId = createPlan(name);
    const copies = plan.courses.map((course) => {
      const id = prefixedId('c');
      return {
        ...course,
        id,
        sessions: (course.sessions || []).map((session, index) => ({
          ...session,
          id: `s_${id}_${index}`,
        })),
      };
    });
    bulkAddCourses(copies, planId);
    setSavedNames((prev) => ({ ...prev, [plan.id]: name }));
    onSaved?.(name);
  };

  const goStep = (next: 1 | 2 | 3) => {
    if (next === 3 && !result && !running) return;
    if (next === 2 && picked.size < 2) return;
    if (next !== 3) stopSearch();
    setStep(next);
  };

  const lunch = prefs.lunchEnabled
    ? { start: timeToMinutes(prefs.lunchStart), end: timeToMinutes(prefs.lunchEnd) }
    : null;

  const footer = (
    <div className="up-gen-foot">
      {step === 1 && (
        <>
          <span className="up-gen-foot-meta">{picked.size} picked · {pinned.size} pinned</span>
          <button
            type="button"
            className="up-gen-primary up-chrome-btn"
            disabled={picked.size < 2}
            onClick={() => setStep(2)}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <button type="button" className="up-gen-quiet up-chrome-btn" onClick={() => setStep(1)}>
            <ChevronLeft className="w-4 h-4" />
            Courses
          </button>
          <button type="button" className="up-gen-primary up-chrome-btn" onClick={handleGenerate}>
            Generate
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <button
            type="button"
            className="up-gen-quiet up-chrome-btn"
            onClick={() => {
              stopSearch();
              setStep(2);
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            Preferences
          </button>
          <span className="up-gen-foot-meta">
            {running
              ? `Checking ${checked.toLocaleString()}…`
              : result
                ? result.plans.length > 0
                  ? `${result.validCount.toLocaleString()} clash-free · top ${result.plans.length}`
                  : '0 clash-free'
                : ''}
          </span>
        </>
      )}
    </div>
  );

  const body = (
    <>
      <div className="up-gen-head">
        <div className="min-w-0">
          <h2 id="generate-plans-title" className="up-gen-title">
            <Shuffle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Generate plans
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="up-icon-btn up-chrome-btn up-pool-icon-hit"
          aria-label="Close generate plans"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <GenerateStepHeader
        step={step}
        canPreferences={picked.size >= 2}
        canResults={step === 3 || result != null}
        onStep={goStep}
      />
      <AnimatedBody
        activeKey={`generate-step-${step}`}
        className="up-gen-scroll up-scroll"
        contentClassName="up-gen-scroll-inner"
      >
        <motion.div key={step} {...contentProps} className="will-change-[opacity]">
          {step === 1 && (
            <CoursesStep
              groups={filteredGroups}
              query={query}
              picked={picked}
              pinned={pinned}
              onQuery={setQuery}
              onToggle={togglePicked}
              onTogglePin={togglePin}
              onSelectAll={selectAll}
            />
          )}
          {step === 2 && (
            <PreferencesStep
              prefs={prefs}
              pickedCount={picked.size}
              pinnedCount={pinned.size}
              courseCount={courseCount}
              courseMin={courseMin}
              courseMax={courseMax}
              creditTarget={creditTarget}
              creditMinBound={creditMinBound}
              creditMaxBound={creditMaxBound}
              creditWindowLabel={creditWindowLabel}
              groups={pickedGroups}
              blocked={blocked}
              lockedIds={lockedIds}
              excludedIds={excludedIds}
              moreOpen={moreOpen}
              onPrefs={patchPrefs}
              onCourseCount={(value) => patchPrefs({ courseCount: value })}
              onCreditTarget={(value) => patchPrefs({ creditTarget: value })}
              onMore={setMoreOpen}
              onAddBlocked={() => {
                blockSeq.current += 1;
                setBlocked((prev) => [...prev, {
                  id: `block_${blockSeq.current}`,
                  day: 'monday',
                  start: '09:00',
                  end: '10:00',
                }]);
                setResult(null);
              }}
              onChangeBlocked={(id, patch) => {
                setBlocked((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
                setResult(null);
              }}
              onRemoveBlocked={(id) => {
                setBlocked((prev) => prev.filter((block) => block.id !== id));
                setResult(null);
              }}
              onLock={(id) => {
                setLockedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                setResult(null);
              }}
              onUnlock={(id) => {
                setLockedIds((prev) => prev.filter((item) => item !== id));
                setResult(null);
              }}
              onExclude={(id) => {
                setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                setLockedIds((prev) => prev.filter((item) => item !== id));
                setResult(null);
              }}
              onUnexclude={(id) => {
                setExcludedIds((prev) => prev.filter((item) => item !== id));
                setResult(null);
              }}
            />
          )}
          {step === 3 && (
            <ResultsStep
              running={running}
              checked={checked}
              result={result}
              lunch={lunch}
              previewId={previewId}
              savedNames={savedNames}
              planNames={planNames}
              onTogglePreview={(id) => setPreviewId((prev) => (prev === id ? null : id))}
              onSave={handleSave}
            />
          )}
        </motion.div>
      </AnimatedBody>
      {footer}
    </>
  );

  if (typeof document === 'undefined') return null;

  const sheetOpen: Transition = reduceMotion ? { duration: 0 } : SHEET_OPEN_TRANSITION;
  const sheetClose: Transition = reduceMotion ? { duration: 0 } : SHEET_CLOSE_TRANSITION;

  return createPortal(
    <AnimatePresence>
      {isOpen && (isPhone ? (
        <React.Fragment key="generate-phone">
          <motion.div
            className="up-sheet-backdrop up-generate-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: sheetClose }}
            transition={sheetOpen}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-plans-title"
            className="up-mobile-sheet up-generate-sheet will-change-transform"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { y: '100%', transition: sheetClose }}
            transition={sheetOpen}
          >
            <button type="button" className="up-pool-handle-hit" onClick={onClose} aria-label="Close generate plans">
              <span className="up-pool-handle" />
            </button>
            <div className="up-gen-sheet-body">{body}</div>
          </motion.div>
        </React.Fragment>
      ) : (
        <motion.div
          key="generate-desktop"
          className="fixed inset-0 z-[100] course-modal-backdrop flex items-center justify-center p-4 bg-black/60 md:backdrop-blur-xs"
          {...backdropProps}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-plans-title"
            {...panelProps}
            className="up-gen-panel will-change-transform"
          >
            {body}
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>,
    document.body,
  );
};
