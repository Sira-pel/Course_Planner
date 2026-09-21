import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const dir = dirname(fileURLToPath(import.meta.url));
const tab = readFileSync(join(dir, 'IcsExportTab.tsx'), 'utf8');
const modal = readFileSync(join(dir, 'ExportModal.tsx'), 'utf8');
const app = readFileSync(join(dir, '../../App.tsx'), 'utf8');
const sync = readFileSync(join(dir, '../GoogleCalendarSync.tsx'), 'utf8');

assert(tab.includes("lazy(() => import('../GoogleCalendarSync'))"), 'ICS tab loads Google sync on demand');
assert(!/^import\s.+GoogleCalendarSync/m.test(tab), 'ICS tab has no static Google sync import');
assert(tab.includes('<Suspense'), 'ICS tab shows a fallback while the sync chunk loads');
assert(!modal.includes('GoogleCalendarSync'), 'export shell does not import Google sync');
assert(!modal.includes('firebase'), 'export shell does not import firebase');
assert(!app.includes('firebase'), 'app entry does not import firebase');
assert(sync.includes("from '../utils/auth'"), 'sync chunk still owns the auth import');
assert(sync.includes('import type { User }'), 'User is type-only so it does not pull auth into a value import');

console.log('google calendar chunk boundary tests passed');
