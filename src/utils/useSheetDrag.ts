import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
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
  // A drag that ends over the handle still fires a click on it. Without this
  // guard, handles that toggle the sheet would close it and then reopen it.
  const justDragged = useRef(false);
  return {
    sheetProps: {
      drag: 'y' as const,
      dragControls: controls,
      dragListener: false,
      dragConstraints: { top: 0, bottom: 0 },
      dragElastic: { top: 0, bottom: 1 },
      dragMomentum: false,
      onDragStart: () => {
        justDragged.current = true;
      },
      onDragEnd: (_event: unknown, info: PanInfo) => {
        window.setTimeout(() => {
          justDragged.current = false;
        }, 100);
        if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
      },
    },
    handleProps: {
      onPointerDown: (event: ReactPointerEvent) => controls.start(event),
      onClickCapture: (event: ReactMouseEvent) => {
        if (!justDragged.current) return;
        event.stopPropagation();
        event.preventDefault();
      },
      style: { touchAction: 'none' as const, userSelect: 'none' as const },
    },
  };
}
