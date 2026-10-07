export interface ShortcutItem {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'courses' | 'navigation' | 'tools';
  defaultKey: string;
  isCustomizable: boolean;
}

export const SHORTCUT_DEFINITIONS: ShortcutItem[] = [
  // Courses
  {
    id: 'add_course',
    name: 'Add Course',
    description: 'Open full course creation dialog',
    category: 'courses',
    defaultKey: 'Alt+N',
    isCustomizable: true,
  },
  {
    id: 'quick_add',
    name: 'Quick add',
    description: 'Open smart text-based quick course parser',
    category: 'courses',
    defaultKey: 'Alt+K',
    isCustomizable: true,
  },
  {
    id: 'pool',
    name: 'Toggle Course Pool',
    description: 'Expand or collapse the course pool sidebar',
    category: 'courses',
    defaultKey: 'Alt+P',
    isCustomizable: true,
  },

  // Tools & Sharing
  {
    id: 'export',
    name: 'Export Schedule',
    description: 'Export as clean text, .ics calendar, or PNG snapshot',
    category: 'tools',
    defaultKey: 'Alt+E',
    isCustomizable: true,
  },
  {
    id: 'import',
    name: 'Import Courses',
    description: 'Import from Excel, syllabus table, or .ics calendar',
    category: 'tools',
    defaultKey: 'Alt+I',
    isCustomizable: true,
  },
  {
    id: 'share',
    name: 'Share Plan Link',
    description: 'Copy or view shareable friend schedule link',
    category: 'tools',
    defaultKey: 'Alt+S',
    isCustomizable: true,
  },
  {
    id: 'compare',
    name: 'Compare Plans',
    description: 'Toggle ghost overlay comparison dropdown',
    category: 'tools',
    defaultKey: 'Alt+C',
    isCustomizable: true,
  },

  // Navigation & Plans
  {
    id: 'duplicate_plan',
    name: 'Duplicate Plan',
    description: 'Create a duplicate scenario copy of active plan',
    category: 'navigation',
    defaultKey: 'Alt+D',
    isCustomizable: true,
  },
  {
    id: 'switch_plan',
    name: 'Switch Plan (1-9)',
    description: 'Quickly switch to Plan A, B, C... when not in an input',
    category: 'navigation',
    defaultKey: '1 - 9',
    isCustomizable: false,
  },
  {
    id: 'undo',
    name: 'Undo Action',
    description: 'Undo the last change made to your plans',
    category: 'navigation',
    defaultKey: 'Ctrl+Z',
    isCustomizable: false,
  },
  {
    id: 'redo',
    name: 'Redo Action',
    description: 'Redo the last undone schedule action',
    category: 'navigation',
    defaultKey: 'Ctrl+Y',
    isCustomizable: false,
  },

  // General
  {
    id: 'theme',
    name: 'Toggle Theme',
    description: 'Toggle light/dark',
    category: 'general',
    defaultKey: 'Alt+T',
    isCustomizable: true,
  },
  {
    id: 'help',
    name: 'Help',
    description: 'Open help walkthrough and workflow guide',
    category: 'general',
    defaultKey: 'Alt+H',
    isCustomizable: true,
  },
  {
    id: 'shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Open shortcut cheatsheet & rebind editor',
    category: 'general',
    defaultKey: '?',
    isCustomizable: false,
  },
  {
    id: 'escape',
    name: 'Close Dialog / Menu',
    description: 'Close open modals, dropdowns, or sidebar',
    category: 'general',
    defaultKey: 'Escape',
    isCustomizable: false,
  },
];

/**
 * Formats a key combo string (e.g. "Alt+N" or "Ctrl+Shift+Z") into human-friendly key chips.
 */
export function formatShortcutKeys(keyCombo: string, isMac: boolean = false): string[] {
  if (!keyCombo) return [];
  if (keyCombo === '?' || keyCombo === 'Escape' || keyCombo === '1 - 9') {
    return [keyCombo];
  }

  const parts = keyCombo.split('+').map((p) => p.trim());
  return parts.map((part) => {
    const lower = part.toLowerCase();
    if (lower === 'alt') return isMac ? '⌥ Option' : 'Alt';
    if (lower === 'ctrl') return isMac ? '⌘ Cmd' : 'Ctrl';
    if (lower === 'shift') return isMac ? '⇧ Shift' : 'Shift';
    return part.toUpperCase();
  });
}
