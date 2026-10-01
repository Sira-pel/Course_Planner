import React from 'react';
import { HelpModal } from './HelpModal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <HelpModal
      isOpen={isOpen}
      initialTab="shortcuts"
      onClose={onClose}
    />
  );
};
