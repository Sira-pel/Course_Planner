import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { PERSIST_SCHEMA_VERSION } from '../../store/persist';
import { useScheduleStore } from '../../store/useScheduleStore';
import { Course } from '../../types/schedule';
import { generateScheduleText, TextExportFormat } from '../../utils/textExport';
import { downloadIcsFile, downloadCourseIcsFile } from '../../utils/icsExport';
import { downloadScheduleImage, exportScheduleToImage } from '../../utils/imageExport';
import {
  X,
  Calendar,
  Image,
  FileText,
  Database,
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import { encodePlanToShareUrl } from '../../utils/shareLink';
import { EASE_OUT } from '../../utils/motion';
import { TextExportTab } from './TextExportTab';
import { IcsExportTab } from './IcsExportTab';
import { ImageExportTab } from './ImageExportTab';
import { BackupTab } from './BackupTab';

export type ExportTabType = 'text' | 'share' | 'ics' | 'image' | 'backup';

interface ExportModalProps {
  isOpen: boolean;
  initialTab?: ExportTabType;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, initialTab = 'text', onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && <ExportModalBody initialTab={initialTab} onClose={onClose} />}
    </AnimatePresence>
  );
};

const ExportModalBody: React.FC<{ initialTab?: ExportTabType; onClose: () => void }> = ({ initialTab = 'text', onClose }) => {
  const {
    plans,
    activePlanId,
    catalogCourses,
    showWeekends,
    startHour,
    endHour,
    theme,
    semesterStart,
    semesterEnd,
    setSemesterDates,
    importFullState,
  } = useScheduleStore(
    useShallow((state) => ({
      plans: state.plans,
      activePlanId: state.activePlanId,
      catalogCourses: state.catalogCourses,
      showWeekends: state.showWeekends,
      startHour: state.startHour,
      endHour: state.endHour,
      theme: state.theme,
      semesterStart: state.semesterStart,
      semesterEnd: state.semesterEnd,
      setSemesterDates: state.setSemesterDates,
      importFullState: state.importFullState,
    }))
  );
  const activePlan = useMemo(() => plans.find((p) => p.id === activePlanId) || plans[0], [plans, activePlanId]);

  // Close modal when user presses Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [activeTab, setActiveTab] = useState<ExportTabType>(initialTab);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset scroll position to top whenever active tab changes to prevent scroll glitching
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const shareUrl = useMemo(() => (activePlan ? encodePlanToShareUrl(activePlan) : ''), [activePlan]);

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Text Export State
  const [textFormat, setTextFormat] = useState<TextExportFormat>('standard');
  const [copiedText, setCopiedText] = useState(false);

  // Image Export State
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageTheme, setImageTheme] = useState<'light' | 'dark'>(theme);

  // Backup State
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Memoize generated text so it only recalculates when activePlan or textFormat changes
  const generatedText = useMemo(() => {
    if (!activePlan) return '';
    return generateScheduleText(activePlan, textFormat);
  }, [activePlan, textFormat]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(activePlan, semesterStart, semesterEnd);
  };

  const handleDownloadCourseIcs = (course: Course) => {
    downloadCourseIcsFile(activePlan, course, semesterStart, semesterEnd);
  };

  const handleGeneratePreviewImage = async () => {
    setGeneratingImage(true);
    try {
      const url = await exportScheduleToImage(activePlan, {
        theme: imageTheme,
        showWeekends,
        startHour,
        endHour,
      });
      setImagePreviewUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    await downloadScheduleImage(activePlan, {
      theme: imageTheme,
      showWeekends,
      startHour,
      endHour,
    });
  };

  const handleDownloadBackup = () => {
    const backupData = {
      version: PERSIST_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      activePlanId,
      plans,
      catalogCourses,
      showWeekends,
      startHour,
      endHour,
      theme,
      semesterStart,
      semesterEnd,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Uniplan_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportJson(content);
        setImportError(null);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    setImportError(null);
    setImportSuccess(false);
    if (!importJson.trim()) {
      setImportError('Please paste or upload a valid JSON backup string');
      return;
    }
    const res = importFullState(importJson);
    if (res.success) {
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setImportError(res.error || 'Failed to parse JSON backup');
    }
  };

  const exportTabs: { id: ExportTabType; label: string; mobileLabel?: string; icon: React.ReactNode }[] = [
    { id: 'text', label: 'Clean Text', icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'share', label: 'Share Link', icon: <Share2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'ics', label: 'Google Calendar (.ics)', mobileLabel: 'Google Cal (.ics)', icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'image', label: 'PNG Snapshot', icon: <Image className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'backup', label: 'JSON Backup', icon: <Database className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 4 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full min-w-0 p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="export-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Export Schedule & Backup
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Exporting: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> ({activePlan.courses.length} courses)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher - with smooth sliding layout pill */}
        <div className="grid grid-cols-2 sm:grid-cols-5 md:flex md:items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-3 shrink-0 overflow-x-auto no-scrollbar relative [scrollbar-width:none]">
          {exportTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'image' && !imagePreviewUrl) {
                    handleGeneratePreviewImage();
                  }
                }}
                title={tab.label}
                className={`relative py-2 sm:py-1.5 px-2 md:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-center min-w-0 md:flex-1 md:min-w-max md:shrink-0 transition-colors duration-150 z-10 ${
                  tab.id === 'backup' ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeExportTabPill"
                    className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                {tab.icon}
                {tab.mobileLabel ? (
                  <>
                    <span className="md:hidden truncate">{tab.mobileLabel}</span>
                    <span className="hidden md:inline md:whitespace-nowrap">{tab.label}</span>
                  </>
                ) : (
                  <span className="truncate md:whitespace-nowrap">{tab.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body - Smooth Cross-fade without vertical displacement glitch */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pt-4 pb-2 pr-0.5 up-scroll overscroll-contain [overflow-anchor:none]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              className="w-full"
            >
              {activeTab === 'text' && (
                <TextExportTab
                  textFormat={textFormat}
                  copiedText={copiedText}
                  generatedText={generatedText}
                  onFormat={setTextFormat}
                  onCopy={handleCopyText}
                />
              )}

              {activeTab === 'share' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                    <div className="flex items-center gap-2 mb-1">
                      <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <h3 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                        Share Schedule with Friends
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Anyone with this link can view your schedule, overlay it on their own classes, or copy courses to their plan.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Shareable URL:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyShareUrl}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                      >
                        {copiedShareUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedShareUrl ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ics' && (
                <IcsExportTab
                  activePlan={activePlan}
                  semesterStart={semesterStart}
                  semesterEnd={semesterEnd}
                  onSemesterStart={(v) => setSemesterDates(v, semesterEnd)}
                  onSemesterEnd={(v) => setSemesterDates(semesterStart, v)}
                  onDownloadIcs={handleDownloadIcs}
                  onDownloadCourseIcs={handleDownloadCourseIcs}
                />
              )}

              {activeTab === 'image' && (
                <ImageExportTab
                  imageTheme={imageTheme}
                  imagePreviewUrl={imagePreviewUrl}
                  generatingImage={generatingImage}
                  onToggleTheme={() => setImageTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                  onRefresh={handleGeneratePreviewImage}
                  onDownload={handleDownloadImage}
                />
              )}

              {activeTab === 'backup' && (
                <BackupTab
                  importJson={importJson}
                  importError={importError}
                  importSuccess={importSuccess}
                  onImportJsonChange={(v) => {
                    setImportJson(v);
                    setImportError(null);
                  }}
                  onFileUpload={handleFileUpload}
                  onDownloadBackup={handleDownloadBackup}
                  onApplyImport={handleApplyImport}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center up-chrome-btn active:scale-95"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
