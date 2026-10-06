import React, { Component, Suspense, useRef, useState, type ReactNode } from 'react';

/** True only on the open that replaces a dialog already on screen. Cleared on the next frame. */
export const DialogReplaceAppearContext = React.createContext(false);

/** Set while a shortcut replaces the course dialog, so its unmount does not focus the opener. */
export const SuppressFocusRestoreContext = React.createContext<React.MutableRefObject<boolean> | null>(null);

/** Latch the replace flag for this open so the backdrop does not fade in from transparent. */
export function useDialogReplaceAppear(isOpen: boolean): boolean {
  const replacing = React.useContext(DialogReplaceAppearContext);
  const latched = useRef(false);
  if (!isOpen) latched.current = false;
  else if (replacing) latched.current = true;
  return latched.current;
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

export function DeferredDialog({
  open,
  onClose,
  instantDismiss = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Drop a closing dialog immediately so a shortcut replace cannot leave it stacked. */
  instantDismiss?: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [heldClosed, setHeldClosed] = useState(false);
  if (open && !mounted) setMounted(true);
  if (!open && instantDismiss && !heldClosed) setHeldClosed(true);
  if (open && heldClosed) setHeldClosed(false);
  // Keep an opening dialog in this same render. Waiting for `mounted` left one
  // frame with no backdrop after the previous dialog was removed.
  if (!open && (!mounted || instantDismiss || heldClosed)) return null;

  return (
    <DialogErrorBoundary open={open} onClose={onClose}>
      <Suspense fallback={null}>{children}</Suspense>
    </DialogErrorBoundary>
  );
}
