import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { ExportTabType } from '../export/ExportModal';

type ImportTab = 'excel' | 'share' | 'ics' | 'backup';

interface ImportExportMenuProps {
  menuEnter: TargetAndTransition;
  menuShown: TargetAndTransition;
  menuLeave: TargetAndTransition;
  menuOpenTransition: Transition;
  onOpenImport?: (tab?: ImportTab) => void;
  onOpenExport: (tab?: ExportTabType, focus?: 'google') => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExportMenu({
  menuEnter,
  menuShown,
  menuLeave,
  menuOpenTransition,
  onOpenImport,
  onOpenExport,
  open,
  onOpenChange,
}: ImportExportMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const chooseImport = (tab: ImportTab) => {
    onOpenChange(false);
    onOpenImport?.(tab);
  };

  const chooseExport = (tab: ExportTabType, focus?: 'google') => {
    onOpenChange(false);
    onOpenExport(tab, focus);
  };

  return (
    <div className="up-import-anchor" ref={rootRef}>
      <button
        type="button"
        id="btn-import-export"
        className={`up-text-trigger up-import-export ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="up-import-export-short">Import</span>
        <span className="up-import-export-full">Import / Export</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Import and export"
            initial={menuEnter}
            animate={menuShown}
            exit={menuLeave}
            transition={menuOpenTransition}
            style={{ transformOrigin: 'top right' }}
            className="up-menu up-import-menu"
          >
            <p className="up-import-label">Import</p>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseImport('excel')}>Spreadsheet</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseImport('share')}>Share link</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseImport('ics')}>Calendar file</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseImport('backup')}>Backup</button>
            <p className="up-import-label">Export</p>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('text')}>Text</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('share')}>Share link</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('ics')}>Calendar file</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('ics', 'google')}>Google Calendar</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('image')}>Image</button>
            <button type="button" role="menuitem" className="up-more-item" onClick={() => chooseExport('backup')}>Backup</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
