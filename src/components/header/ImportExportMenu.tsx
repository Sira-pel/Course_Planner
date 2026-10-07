import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'motion/react';
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  Image,
  Link2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
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

  const row = (icon: LucideIcon, label: string, hint: string | undefined, onClick: () => void) => {
    const Icon = icon;
    return (
      <button type="button" role="menuitem" className="up-more-item up-import-row" onClick={onClick}>
        <Icon className="up-import-ico" strokeWidth={1.75} aria-hidden />
        <span className="up-import-name">{label}</span>
        {hint ? <span className="up-import-hint">{hint}</span> : null}
      </button>
    );
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
            {row(FileSpreadsheet, 'Spreadsheet', '.xlsx .csv', () => chooseImport('excel'))}
            {row(Link2, 'Share link', undefined, () => chooseImport('share'))}
            {row(Calendar, 'Calendar file', '.ics', () => chooseImport('ics'))}
            {row(Download, 'Restore backup', '.json', () => chooseImport('backup'))}
            <div className="up-import-rule" role="separator" />
            <p className="up-import-label">Export</p>
            {row(AlignLeft, 'Copy as text', undefined, () => chooseExport('text'))}
            {row(Link2, 'Share link', undefined, () => chooseExport('share'))}
            {row(Calendar, 'Calendar file', '.ics', () => chooseExport('ics'))}
            {row(Clock, 'Google Calendar', 'sync', () => chooseExport('ics', 'google'))}
            {row(Image, 'Image', '.png', () => chooseExport('image'))}
            {row(Upload, 'Save backup', '.json', () => chooseExport('backup'))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
