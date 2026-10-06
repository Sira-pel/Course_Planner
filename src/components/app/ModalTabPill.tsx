import { motion } from 'motion/react';
import { TAB_PILL_TRANSITION, useInstantModalMotion } from '../../utils/motion';

/** Sliding active-tab background. `layoutId` must be unique per modal. */
export function ModalTabPill({ layoutId }: { layoutId: string }) {
  const instant = useInstantModalMotion();
  const className = 'pointer-events-none absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-slate-900';

  if (instant) {
    return <span aria-hidden className={className} />;
  }

  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      className={className}
      initial={false}
      transition={TAB_PILL_TRANSITION}
    />
  );
}
