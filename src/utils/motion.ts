export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_POP = [0.34, 1.36, 0.64, 1] as const;
export const EASE_SNAP = [0.2, 0.8, 0.2, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const MODAL_BACKDROP_ANIMATION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASE_OUT },
};

export const MODAL_SHEET_ANIMATION = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
  transition: { duration: 0.22, ease: EASE_OUT },
};

export const TAB_CONTENT_ANIMATION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: EASE_OUT },
};
