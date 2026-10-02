export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_POP = [0.34, 1.36, 0.64, 1] as const;
export const EASE_SNAP = [0.2, 0.8, 0.2, 1] as const;
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const MODAL_BACKDROP_ANIMATION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
  transition: { duration: 0.18, ease: EASE_OUT },
};

export const MODAL_SHEET_ANIMATION = {
  initial: { opacity: 0, scale: 0.975, y: 5 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.985, y: 3, transition: { duration: 0.12, ease: EASE_OUT } },
  transition: { duration: 0.18, ease: EASE_OUT },
};

export const TAB_CONTENT_ANIMATION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2, transition: { duration: 0.07, ease: EASE_OUT } },
  transition: { duration: 0.14, ease: EASE_OUT },
};

export const TAB_PILL_SPRING = {
  type: 'spring',
  stiffness: 550,
  damping: 38,
  mass: 0.8,
} as const;
