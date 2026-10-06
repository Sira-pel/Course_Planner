import React, {
  Component,
  Suspense,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ModalLoadContextValue = {
  markScrimShown: () => void;
  takeHandoff: () => boolean;
  markReady: () => void;
};

const ModalLoadContext = React.createContext<ModalLoadContextValue>({
  markScrimShown: () => {},
  takeHandoff: () => false,
  markReady: () => {},
});

// True only when a loading scrim was actually painted before this dialog mounted.
// A warm open resolves in the same commit, never paints the scrim, and fades normally.
export function useModalBackdropHandoff(isOpen: boolean): boolean {
  const { takeHandoff } = useContext(ModalLoadContext);
  const handoff = useRef(false);
  const wasOpen = useRef(false);
  if (isOpen && !wasOpen.current) {
    handoff.current = takeHandoff();
  }
  wasOpen.current = isOpen;
  return handoff.current;
}

// Skip the content fade on the same open that already fades the backdrop.
// Tab changes after the first frame still play their own fade.
export function useSkipContentEnter(isOpen: boolean): boolean {
  const skip = useRef(true);
  if (!isOpen) skip.current = true;
  React.useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => {
      skip.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);
  return skip.current;
}

function ModalScrim({ onClose }: { onClose: () => void }) {
  const { markScrimShown } = useContext(ModalLoadContext);
  useLayoutEffect(() => {
    markScrimShown();
  }, [markScrimShown]);
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 md:backdrop-blur-xs"
      onMouseDown={onClose}
      aria-hidden="true"
    />
  );
}

function DialogLoadError({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-load-error-title"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 text-center"
      >
        <h2 id="dialog-load-error-title" className="text-base font-semibold text-slate-900 dark:text-white">
          Couldn't open this dialog
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Check your connection and try again.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

class DialogErrorBoundary extends Component<
  { open: boolean; onClose: () => void; children: ReactNode },
  { failed: boolean }
> {
  public state = { failed: false };

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public render() {
    if (this.state.failed) {
      if (!this.props.open) return null;
      return <DialogLoadError onClose={this.props.onClose} />;
    }
    return this.props.children;
  }
}

function MarkReady({ children }: { children: ReactNode }) {
  const { markReady } = useContext(ModalLoadContext);
  useLayoutEffect(() => {
    markReady();
  }, [markReady]);
  return children;
}

export function DeferredDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  if (open && !mounted) setMounted(true);

  const [ready, setReady] = useState(false);
  const scrimShown = useRef(false);

  const markScrimShown = useCallback(() => {
    scrimShown.current = true;
  }, []);
  const takeHandoff = useCallback(() => scrimShown.current, []);
  const markReady = useCallback(() => {
    scrimShown.current = false;
    setReady(true);
  }, []);

  const loadContext = useMemo(
    () => ({ markScrimShown, takeHandoff, markReady }),
    [markScrimShown, takeHandoff, markReady]
  );

  if (!mounted) return null;

  return (
    <ModalLoadContext.Provider value={loadContext}>
      <DialogErrorBoundary open={open} onClose={onClose}>
        {open && !ready ? <ModalScrim onClose={onClose} /> : null}
        <Suspense fallback={null}>
          <MarkReady>{children}</MarkReady>
        </Suspense>
      </DialogErrorBoundary>
    </ModalLoadContext.Provider>
  );
}
