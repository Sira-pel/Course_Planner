import { useEffect, useState } from 'react';
import type { TargetAndTransition } from 'motion/react';
import { useDialogReplaceAppear, useSkipContentEnter } from '../components/app/DeferredDialog';

// Signature smooth curve matching the app's theme transition [0.3, 0.55, 0.3, 1]
export const EASE_SMOOTH = [0.3, 0.55, 0.3, 1] as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_DECEL = [0.16, 1, 0.3, 1] as const;
export const EASE_POP = [0.34, 1.36, 0.64, 1] as const;
export const EASE_SNAP = [0.2, 0.8, 0.2, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_SHEET_ENTER = [0.32, 0.72, 0, 1] as const;

export const SHEET_OPEN_TRANSITION = {
  duration: 0.24,
  ease: EASE_DECEL,
} as const;

export const SHEET_CLOSE_TRANSITION = {
  duration: 0.18,
  ease: EASE_OUT,
} as const;

export const SHEET_BACKDROP_OPEN_TRANSITION = {
  duration: 0.24,
  ease: EASE_OUT,
} as const;

export const SHEET_BACKDROP_CLOSE_TRANSITION = {
  duration: 0.18,
  ease: EASE_OUT,
} as const;

export const MENU_OPEN_TRANSITION = {
  duration: 0.22,
  ease: EASE_SMOOTH,
} as const;

export const MENU_CLOSE_TRANSITION = {
  duration: 0.16,
  ease: EASE_SMOOTH,
} as const;

/** Backdrop fade. Open matches the sheet; close is shorter. */
export const MODAL_BACKDROP_ANIMATION = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: SHEET_BACKDROP_OPEN_TRANSITION },
  exit: { opacity: 0, transition: SHEET_BACKDROP_CLOSE_TRANSITION },
};

/** Panel enter/exit. Close reuses the faster sheet timing. */
export const MODAL_SHEET_ANIMATION = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SHEET_OPEN_TRANSITION },
  exit: { opacity: 0, scale: 0.975, y: 4, transition: SHEET_CLOSE_TRANSITION },
};

/** Opacity-only sheet for reduced motion and lite devices. */
export const MODAL_SHEET_PLAIN_ANIMATION = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: SHEET_OPEN_TRANSITION },
  exit: { opacity: 0, transition: SHEET_CLOSE_TRANSITION },
};

/** Tab fade. The 4px rise plays on enter only. */
export const TAB_CONTENT_ANIMATION = {
  initial: { opacity: 0.25, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_SMOOTH } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } },
};

export const TAB_CONTENT_PLAIN_ANIMATION = {
  initial: { opacity: 0.25 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_SMOOTH } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } },
};

export const TAB_PILL_TRANSITION = {
  duration: 0.22,
  ease: EASE_SMOOTH,
} as const;

export function isLowEndDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
}

export function initLiteMotion(): void {
  if (typeof document === 'undefined') return;
  if (isLowEndDevice()) {
    document.documentElement.setAttribute('data-lite-motion', '');
  }
}

export function readLiteMotion(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-lite-motion');
}

function readReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Reduced motion and low-end devices skip transforms and height animation. */
export function useInstantModalMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion);
  const [lite, setLite] = useState(readLiteMotion);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReduced = () => setReduced(media.matches);
    syncReduced();
    media.addEventListener('change', syncReduced);

    const root = document.documentElement;
    const syncLite = () => setLite(root.hasAttribute('data-lite-motion'));
    syncLite();
    const observer = new MutationObserver(syncLite);
    observer.observe(root, { attributes: true, attributeFilter: ['data-lite-motion'] });

    return () => {
      media.removeEventListener('change', syncReduced);
      observer.disconnect();
    };
  }, []);

  return reduced || lite;
}

type ModalVariant = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
};

export type ModalMotionProps = {
  variants: ModalVariant;
  initial: false | 'initial';
  animate: 'animate';
  exit: 'exit';
};

/**
 * Shared backdrop, panel, and tab-content motion.
 * A shortcut replace skips the enter so the new dialog does not flash in from transparent.
 */
export function useModalMotion(isOpen: boolean): {
  backdropProps: ModalMotionProps;
  panelProps: ModalMotionProps;
  contentProps: ModalMotionProps;
  instant: boolean;
} {
  const replaceAppear = useDialogReplaceAppear(isOpen);
  const skipContentEnter = useSkipContentEnter(isOpen);
  const instant = useInstantModalMotion();

  const backdropProps: ModalMotionProps = {
    variants: MODAL_BACKDROP_ANIMATION,
    initial: replaceAppear ? false : 'initial',
    animate: 'animate',
    exit: 'exit',
  };

  const panelProps: ModalMotionProps = {
    variants: instant ? MODAL_SHEET_PLAIN_ANIMATION : MODAL_SHEET_ANIMATION,
    initial: replaceAppear ? false : 'initial',
    animate: 'animate',
    exit: 'exit',
  };

  const contentProps: ModalMotionProps = {
    variants: instant ? TAB_CONTENT_PLAIN_ANIMATION : TAB_CONTENT_ANIMATION,
    initial: skipContentEnter ? false : 'initial',
    animate: 'animate',
    exit: 'exit',
  };

  return { backdropProps, panelProps, contentProps, instant };
}
