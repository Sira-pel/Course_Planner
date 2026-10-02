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

  // Generate preview image smoothly with debounce when activeTab becomes 'image'
  useEffect(() => {
    if (activeTab === 'image' && !imagePreviewUrl && !generatingImage) {
      const timer = setTimeout(() => {
        handleGeneratePreviewImage();
      }, 160);
      return () => clearTimeout(timer);
    }
  }, [activeTab, imagePreviewUrl, generatingImage]);

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

  const exportTabs: { id: ExportTabType; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'text', label: 'Clean Text', mobileLabel: 'Text', icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'share', label: 'Share Link', mobileLabel: 'Link', icon: <Share2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'ics', label: 'Google Cal (.ics)', mobileLabel: 'Calendar', icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'image', label: 'Snapshot', mobileLabel: 'Image', icon: <Image className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'backup', label: 'JSON Backup', mobileLabel: 'Backup', icon: <Database className="w-3.5 h-3.5 shrink-0" /> },
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
        exit={{ opacity: 0, scale: 0.98, y: 5 }}
        transition={{ duration: 0.26, ease: EASE_OUT }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full min-w-0 p-3 sm:p-5 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] flex flex-col overflow-hidden will-change-transform"
      >
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="export-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Export Schedule & Backup
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Plan: <strong className="text-indigo-600 dark:text-indigo-400">{activePlan.name}</strong> ({activePlan.courses.length} courses)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shrink-0 up-chrome-btn"
            aria-label="Close export dialog"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Switcher - Single clean row on all screen sizes */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mt-2 sm:mt-2.5 shrink-0 relative overflow-hidden [scrollbar-width:none]">
          {exportTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`relative py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0 transition-all duration-200 ease-out z-10 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline truncate">{tab.label}</span>
                <span className="inline sm:hidden truncate">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body - Instant synchronous switch with silky fast fade */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pt-3 pb-2 pr-0.5 up-scroll overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]"
        >
          <motion.div
            key={activeTab}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="w-full will-change-[opacity] transform-gpu"
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
        </div>
      </motion.div>
    </motion.div>
  );
};
