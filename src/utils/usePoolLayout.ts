import { useEffect, useState } from 'react';
import {
  layoutFromMatchMedia,
  stabilizePoolLayout,
  type PoolLayout,
} from './layoutBreakpoint';

export type { PoolLayout };

function readLayout(): PoolLayout {
  if (typeof window === 'undefined') return 'desktop';
  return layoutFromMatchMedia(
    window.matchMedia('(max-width: 639px)').matches,
    window.matchMedia('(min-width: 640px) and (max-width: 1023px)').matches
  );
}

export function usePoolLayout(): PoolLayout {
  const [layout, setLayout] = useState<PoolLayout>(readLayout);

  useEffect(() => {
    const phone = window.matchMedia('(max-width: 639px)');
    const tablet = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
    let raf = 0;

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const raw = layoutFromMatchMedia(phone.matches, tablet.matches);
        setLayout((current) => stabilizePoolLayout(window.innerWidth, current, raw));
      });
    };

    phone.addEventListener('change', onChange);
    tablet.addEventListener('change', onChange);
    return () => {
      cancelAnimationFrame(raf);
      phone.removeEventListener('change', onChange);
      tablet.removeEventListener('change', onChange);
    };
  }, []);

  return layout;
}

export function useIsPhone(): boolean {
  return usePoolLayout() === 'phone';
}
