import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Header.tsx'), 'utf8');

assert(
  src.includes('id="btn-theme"'),
  'header still has the dedicated theme button'
);
assert(
  src.includes('onClick={(event) => handleToggleTheme(event, false)}'),
  'header theme button keeps Settings open'
);
assert(
  src.includes('onToggleTheme={(event) => handleToggleTheme(event, false)}'),
  'Settings Light/Dark keeps Settings open'
);
assert(!src.includes('flushSync'), 'theme apply does not force a sync React commit');

const toggleFn = src.slice(src.indexOf('const handleToggleTheme'), src.indexOf('const handleCreatePlan'));
assert(toggleFn.includes('isPointerClick'), 'keyboard/detail: 0 still skips the circle');
assert(toggleFn.includes('reduceMotion'), 'reduced motion still skips the circle');
assert(!toggleFn.includes('isPhone'), 'phone width does not skip the circle');
assert(toggleFn.includes('applyDomTheme'), 'pointer apply paints html.dark synchronously');
assert(toggleFn.includes('persistTheme'), 'pointer apply writes uniplan_theme synchronously');
assert(toggleFn.includes('commitTheme'), 'Zustand theme commit waits for the reveal');
assert(!toggleFn.includes('toggleTheme()'), 'pointer path does not set() through toggleTheme');
assert(toggleFn.includes('setTheme(next)'), 'keyboard and reduced-motion still commit immediately');

assert(/onOpenCatalog=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'opening the catalog still closes Settings');
assert(/onImportIcsClick=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'import still closes Settings');
assert(/onOpenExport=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'export still closes Settings');
assert(/onOpenShortcuts=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'shortcuts still closes Settings');

console.log('Header.theme tests passed');
