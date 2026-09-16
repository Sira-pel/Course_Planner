/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, RotateCcw, HelpCircle, ShoppingBag, Plus, MoreVertical } from 'lucide-react';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_POP = [0.34, 1.36, 0.64, 1] as const;

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
  onRequestClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onCloseMoreMenu: () => void;
}

export function MobileDock({
  isMoreOpen,
  isConfirmingClear,
  catalogCount,
  reduceMotion,
  onToggleMore,
  onTogglePool,
  onAddCourse,
  onLoadDemo,
  onOpenShortcuts,
  onRequestClear,
  onConfirmClear,
  onCancelClear,
  onCloseMoreMenu,
}: MobileDockProps) {
  const menuOpenTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: EASE_OUT };
  const menuCloseTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: EASE_OUT };

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
                      : { y: -8, opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }
                  }
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_POP }}
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
                  transition: reduceMotion ? { duration: 0 } : menuCloseTransition,
                }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
                onClick={onCloseMoreMenu}
              />
            )}
            {isMoreOpen && (
              <motion.div
                key="more-menu"
                role="menu"
                aria-label="More actions"
                className="up-menu up-more-menu"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { opacity: 0, y: 8, transition: menuCloseTransition }
                }
                transition={menuOpenTransition}
              >
                {isConfirmingClear ? (
                  <div className="up-sheet-empty">
                    <p>Clear all plans and pool?</p>
                    <button
                      type="button"
                      className="up-sheet-btn up-sheet-btn-primary up-chrome-btn"
                      onClick={onConfirmClear}
                    >
                      Yes, clear all
                    </button>
                    <button
                      type="button"
                      className="up-sheet-btn up-sheet-btn-secondary up-chrome-btn"
                      onClick={onCancelClear}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
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
                    <button
                      type="button"
                      role="menuitem"
                      className="up-more-item up-chrome-btn"
                      onClick={() => {
                        onCloseMoreMenu();
                        onOpenShortcuts();
                      }}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Shortcuts
                    </button>
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
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
