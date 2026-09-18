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

assert(/onOpenCatalog=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'opening the catalog still closes Settings');
assert(/onImportIcsClick=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'import still closes Settings');
assert(/onOpenExport=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'export still closes Settings');
assert(/onOpenShortcuts=\{\(\) => \{\s*setIsSettingsOpen\(false\)/.test(src), 'shortcuts still closes Settings');

console.log('Header.theme tests passed');
