import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import {
  AlignLeft,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  Image,
  Link2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ExportTabType } from '../export/ExportModal';
import { EASE_OUT, SHEET_CLOSE_TRANSITION, SHEET_OPEN_TRANSITION } from '../../utils/motion';

type ImportTab = 'excel' | 'share' | 'ics' | 'backup';

interface ImportExportActions {
  onOpenImport?: (tab?: ImportTab) => void;
  onOpenExport: (tab?: ExportTabType, focus?: 'google') => void;
  onClose: () => void;
}

interface ImportExportItem {
  icon: LucideIcon;
  label: string;
  hint?: string;
  run: (actions: ImportExportActions) => void;
}

const IMPORT_EXPORT_SECTIONS: { label: string; items: ImportExportItem[] }[] = [
  {
    label: 'Import',
    items: [
      { icon: FileSpreadsheet, label: 'Spreadsheet', hint: '.xlsx .csv', run: (a) => a.onOpenImport?.('excel') },
      { icon: Link2, label: 'Share link', run: (a) => a.onOpenImport?.('share') },
      { icon: Calendar, label: 'Calendar file', hint: '.ics', run: (a) => a.onOpenImport?.('ics') },
      { icon: Download, label: 'Restore backup', hint: '.json', run: (a) => a.onOpenImport?.('backup') },
    ],
  },
  {
    label: 'Export',
    items: [
      { icon: AlignLeft, label: 'Copy as text', run: (a) => a.onOpenExport('text') },
      { icon: Link2, label: 'Share link', run: (a) => a.onOpenExport('share') },
      { icon: Calendar, label: 'Calendar file', hint: '.ics', run: (a) => a.onOpenExport('ics') },
      { icon: Clock, label: 'Google Calendar', hint: 'sync', run: (a) => a.onOpenExport('ics', 'google') },
      { icon: Image, label: 'Image', hint: '.png', run: (a) => a.onOpenExport('image') },
      { icon: Upload, label: 'Save backup', hint: '.json', run: (a) => a.onOpenExport('backup') },
    ],
  },
];

function ImportExportList({ actions }: { actions: ImportExportActions }) {
  return (
    <>
      {IMPORT_EXPORT_SECTIONS.map((section, index) => (
        <div key={section.label}>
          {index > 0 && <div className="up-import-rule" role="separator" />}
          <p className="up-import-label">{section.label}</p>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="up-more-item up-import-row"
                onClick={() => {
                  actions.onClose();
                  item.run(actions);
                }}
              >
                <Icon className="up-import-ico" strokeWidth={1.75} aria-hidden />
                <span className="up-import-name">{item.label}</span>
                {item.hint ? <span className="up-import-hint">{item.hint}</span> : null}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

interface ImportExportMenuProps {
  isPhone: boolean;
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
  isPhone,
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
  const reduceMotion = useReducedMotion();
  const close = () => onOpenChange(false);
  const actions: ImportExportActions = { onOpenImport, onOpenExport, onClose: close };

  useEffect(() => {
    if (!open || isPhone) return;
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
  }, [open, onOpenChange, isPhone]);

  useEffect(() => {
    if (!isPhone || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('up-sheet-open');
    return () => {
      document.body.style.overflow = previous;
      document.body.classList.remove('up-sheet-open');
    };
  }, [isPhone, open]);

  const sheetOpenTransition: Transition = reduceMotion ? { duration: 0 } : SHEET_OPEN_TRANSITION;
  const sheetCloseTransition: Transition = reduceMotion ? { duration: 0 } : SHEET_CLOSE_TRANSITION;

  return (
    <div className="up-import-anchor" ref={rootRef}>
      <button
        type="button"
        id="btn-import-export"
        className={`${isPhone ? 'up-icon-btn' : 'up-text-trigger up-import-export'} up-chrome-btn ${open ? 'is-open' : ''}`}
        aria-haspopup={isPhone ? 'dialog' : 'menu'}
        aria-expanded={open}
        aria-label="Import / Export"
        title="Import / Export"
        onClick={() => onOpenChange(!open)}
      >
        <ArrowUpDown className={isPhone ? 'w-4 h-4' : 'up-import-export-icon'} strokeWidth={1.75} aria-hidden />
        {!isPhone && (
          <>
            <span className="up-import-export-short">Import</span>
            <span className="up-import-export-full">Import / Export</span>
            <ChevronDown className={`up-chevron w-3.5 h-3.5 opacity-60 ${open ? 'is-open' : ''}`} />
          </>
        )}
      </button>
      {isPhone && typeof document !== 'undefined' ? (
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="import-backdrop"
                  className="up-sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: sheetCloseTransition }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
                  onClick={close}
                />
                <motion.div
                  key="import-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Import and export"
                  className="up-mobile-sheet up-import-sheet will-change-transform"
                  initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { y: '100%', transition: sheetCloseTransition }
                  }
                  transition={sheetOpenTransition}
                >
                  <button type="button" className="up-pool-handle-hit" onClick={close} aria-label="Close import and export">
                    <span className="up-pool-handle" />
                  </button>
                  <div className="up-pool-head px-4">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <h2 className="up-pool-title">Import / Export</h2>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 up-chrome-btn"
                      title="Close"
                      aria-label="Close import and export"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="up-mobile-sheet-body up-scroll" role="menu" aria-label="Import and export">
                    <ImportExportList actions={actions} />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )
      ) : (
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
              <ImportExportList actions={actions} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
