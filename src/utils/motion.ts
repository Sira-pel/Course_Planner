// Signature smooth curve matching the app's theme transition [0.3, 0.55, 0.3, 1]
export const EASE_SMOOTH = [0.3, 0.55, 0.3, 1] as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_DECEL = [0.16, 1, 0.3, 1] as const;
export const EASE_POP = [0.34, 1.36, 0.64, 1] as const;
export const EASE_SNAP = [0.2, 0.8, 0.2, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_SHEET_ENTER = [0.32, 0.72, 0, 1] as const;

export const SHEET_OPEN_TRANSITION = {
  duration: 0.32,
  ease: EASE_SHEET_ENTER,
} as const;

export const SHEET_CLOSE_TRANSITION = {
  duration: 0.24,
  ease: EASE_OUT,
} as const;

export const SHEET_BACKDROP_OPEN_TRANSITION = {
  duration: 0.3,
  ease: EASE_OUT,
} as const;

export const SHEET_BACKDROP_CLOSE_TRANSITION = {
  duration: 0.22,
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

export const MODAL_BACKDROP_ANIMATION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: EASE_SMOOTH },
};

export const MODAL_SHEET_ANIMATION = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.975, y: 4 },
  transition: { duration: 0.24, ease: EASE_SMOOTH },
};

export const TAB_CONTENT_ANIMATION = {
  initial: { opacity: 0.25, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3 },
  transition: { duration: 0.2, ease: EASE_SMOOTH },
};

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
