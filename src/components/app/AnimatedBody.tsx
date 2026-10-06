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

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || instant) return;

    const measure = () => {
      const next = Math.ceil(inner.scrollHeight);
      if (next <= 0) return;
      setHeight((prev) => (prev === next ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
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
    >
      <div ref={innerRef} className={contentClassName}>
        {children}
      </div>
    </motion.div>
  );
}
