import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SHEET_OPEN_TRANSITION, useInstantModalMotion } from '../../utils/motion';

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else ref.current = value;
}

/**
 * Animates the height of a modal tab body when its content changes.
 * The frame keeps the caller's max-height so long tabs scroll instead of growing the page.
 * Reduced motion and lite devices apply the new height immediately.
 */
export function AnimatedBody({
  activeKey,
  scrollRef,
  className,
  contentClassName,
  children,
}: {
  activeKey: string;
  scrollRef?: React.Ref<HTMLDivElement>;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const instant = useInstantModalMotion();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  // The content wrapper stretches with the frame, so the observers fire on every
  // frame of our own height animation. Measuring then forces a second layout per
  // frame for nothing; note the change and measure once when the animation ends.
  const animatingRef = useRef(false);
  const dirtyRef = useRef(false);
  const measureRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || instant) return;

    const measure = () => {
      const frame = inner.parentElement;
      if (!frame) return;
      // Read the content's own height. A stretched flex child would otherwise
      // report the frame's current height and keep short tabs stuck open.
      const previous = frame.style.height;
      frame.style.height = 'auto';
      let next = Math.ceil(inner.scrollHeight);
      const fill = inner.querySelector('[data-fill-scroll]');
      if (fill instanceof HTMLElement) {
        next += Math.max(0, fill.scrollHeight - fill.clientHeight);
        const max = parseFloat(getComputedStyle(frame).maxHeight);
        if (Number.isFinite(max) && max > 0) next = Math.min(next, Math.ceil(max));
      }
      frame.style.height = previous;
      if (next <= 0) return;
      setHeight((prev) => (prev === next ? prev : next));
    };

    // At most one measurement per frame, and none while the height is animating.
    let frame = 0;
    const schedule = () => {
      if (animatingRef.current) {
        dirtyRef.current = true;
        return;
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(inner);
    // Course rows can mount inside a collapsed scroller without changing the
    // frame's border box, so also remeasure when those rows appear.
    const mutations = new MutationObserver(schedule);
    mutations.observe(inner, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      if (measureRef.current === measure) measureRef.current = null;
    };
  }, [activeKey, instant]);

  useLayoutEffect(() => {
    if (instant) return;
    const id = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  if (instant) {
    return (
      <div
        ref={scrollRef}
        className={className}
      >
        <div className={contentClassName}>{children}</div>
      </div>
    );
  }

  return (
    <motion.div
      ref={(node) => {
        assignRef(scrollRef, node);
      }}
      className={className}
      initial={false}
      animate={{ height: height ?? 'auto' }}
      transition={live && height != null ? SHEET_OPEN_TRANSITION : { duration: 0 }}
      onAnimationStart={() => {
        animatingRef.current = true;
      }}
      onAnimationComplete={() => {
        animatingRef.current = false;
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        measureRef.current?.();
      }}
    >
      <div ref={innerRef} className={contentClassName}>
        {children}
      </div>
    </motion.div>
  );
}
