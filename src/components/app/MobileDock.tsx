/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import { Sparkles, RotateCcw, HelpCircle, Keyboard, ShoppingBag, Plus, MoreVertical, Smartphone, CheckCircle2, Download } from 'lucide-react';
import { ClearAllDialog } from '../header/ClearAllDialog';
import { EASE_OUT, EASE_POP, EASE_SMOOTH, SHEET_OPEN_TRANSITION, SHEET_CLOSE_TRANSITION, SHEET_BACKDROP_OPEN_TRANSITION, SHEET_BACKDROP_CLOSE_TRANSITION } from '../../utils/motion';
import { usePWAInstall } from '../../utils/usePWAInstall';

const PWAInstallModal = lazy(() => import('../pwa/PWAInstallModal').then((m) => ({ default: m.PWAInstallModal })));

export interface MobileDockProps {
  isMoreOpen: boolean;
  isConfirmingClear: boolean;
  catalogCount: number;
  reduceMotion: boolean | null;
  onToggleMore: () => void;
  onTogglePool: () => void;
  onAddCourse: () => void;
  onLoadDemo: () => void;
  onOpenShortcuts: () => void;
  onOpenHelp?: () => void;
  onOpenExport?: () => void;
  onRequestClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onCloseMoreMenu: () => void;
}

export const MobileDock = React.memo(function MobileDock({
  isMoreOpen,
  isConfirmingClear,
  catalogCount,
  reduceMotion,
  onToggleMore,
  onTogglePool,
  onAddCourse,
  onLoadDemo,
  onOpenShortcuts,
  onOpenHelp,
  onOpenExport,
  onRequestClear,
  onConfirmClear,
  onCancelClear,
  onCloseMoreMenu,
}: MobileDockProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const menuOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_OPEN_TRANSITION;
  const menuCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_CLOSE_TRANSITION;
  const backdropOpenTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_OPEN_TRANSITION;
  const backdropCloseTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SHEET_BACKDROP_CLOSE_TRANSITION;

  useEffect(() => {
    if (!isMoreOpen) return;
    document.body.classList.add('up-sheet-open');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('up-sheet-open');
      document.body.style.overflow = previous;
    };
  }, [isMoreOpen]);

  return (
    <>
      <div className="up-fab-cluster">
        <button
          type="button"
          id="btn-mobile-more"
          onClick={onToggleMore}
          className={`up-fab-more up-chrome-btn ${isMoreOpen ? 'is-open' : ''}`}
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isMoreOpen}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        <button
          type="button"
          id="btn-mobile-pool-pill"
          onClick={onTogglePool}
          className="up-fab-secondary up-chrome-btn"
          title="Open course pool"
        >
          <span className="up-dock-copy">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="up-dock-label">Pool</span>
            <AnimatePresence initial={false} mode="popLayout">
              {catalogCount > 0 && (
                <motion.span
                  key={catalogCount}
                  className="up-fab-count"
                  initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { y: -8, opacity: 0, transition: { duration: 0.16, ease: EASE_SMOOTH } }
                  }
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: EASE_SMOOTH }}
                >
                  {catalogCount}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>

        <button
          type="button"
          id="btn-mobile-add-course-pill"
          onClick={onAddCourse}
          className="up-fab-primary up-chrome-btn"
          title="Add course"
        >
          <Plus className="w-4 h-4" />
          <span>Add course</span>
        </button>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isMoreOpen && (
              <motion.div
                key="more-backdrop"
                className="up-sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: backdropCloseTransition,
                }}
                transition={backdropOpenTransition}
                onClick={onCloseMoreMenu}
              />
            )}
            {isMoreOpen && (
              <motion.div
                key="more-menu"
                role="menu"
                aria-label="More actions"
                className="up-menu up-more-menu"
                initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { y: '100%', transition: menuCloseTransition }
                }
                transition={menuOpenTransition}
              >
                <>
                    {!isInstalled ? (
                      <button
                        type="button"
                        role="menuitem"
                        id="btn-mobile-install-app"
                        className="up-more-item up-chrome-btn text-indigo-600 dark:text-indigo-400 font-semibold"
                        onClick={async () => {
                          onCloseMoreMenu();
                          if (isInstallable) {
                            const outcome = await install();
                            if (!outcome) setShowInstallGuide(true);
                          } else {
                            setShowInstallGuide(true);
                          }
                        }}
                      >
                        <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Install Uniplan app
                      </button>
                    ) : (
                      <div className="up-more-item text-slate-500 dark:text-slate-400 pointer-events-none opacity-80 select-none">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        App installed
                      </div>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-chrome-btn"
                      onClick={() => {
                        onCloseMoreMenu();
                        onLoadDemo();
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Load demo
                    </button>
                    {onOpenHelp && (
                      <button
                        type="button"
                        role="menuitem"
                        className="up-more-item up-chrome-btn"
                        onClick={() => {
                          onCloseMoreMenu();
                          onOpenHelp();
                        }}
                      >
                        <HelpCircle className="w-4 h-4" />
                        Help
                      </button>
                    )}
                    {onOpenExport && (
                      <button
                        type="button"
                        role="menuitem"
                        className="up-more-item up-chrome-btn"
                        onClick={() => {
                          onCloseMoreMenu();
                          onOpenExport();
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Export…
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-more-item-danger up-chrome-btn"
                      onClick={onRequestClear}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear all
                    </button>
                </>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      <ClearAllDialog
        open={isConfirmingClear}
        onCancel={onCancelClear}
        onConfirm={onConfirmClear}
      />
      {typeof document !== 'undefined' &&
        createPortal(
          <Suspense fallback={null}>
            <PWAInstallModal
              isOpen={showInstallGuide}
              onClose={() => setShowInstallGuide(false)}
              isIOS={isIOS}
            />
          </Suspense>,
          document.body
        )}
    </>
  );
});
