import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDragControls, type PanInfo } from 'motion/react';

const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 500;

/**
 * Drag-to-dismiss for a bottom sheet. Spread `sheetProps` on the sheet's
 * `motion.div` and `handleProps` on the handle (and header). Only those areas
 * start a drag, so scrolling the sheet's own content is never hijacked.
 */
export function useSheetDrag(onClose: () => void) {
  const controls = useDragControls();
  return {
    sheetProps: {
      drag: 'y' as const,
      dragControls: controls,
      dragListener: false,
      dragConstraints: { top: 0, bottom: 0 },
      dragElastic: { top: 0, bottom: 1 },
      dragMomentum: false,
      onDragEnd: (_event: unknown, info: PanInfo) => {
        if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
      },
    },
    handleProps: {
      onPointerDown: (event: ReactPointerEvent) => controls.start(event),
      style: { touchAction: 'none' as const, userSelect: 'none' as const },
    },
  };
}
