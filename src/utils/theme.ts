export type ThemeName = 'light' | 'dark';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

export function applyDomTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem('uniplan_theme', theme);
  } catch {
    // Private mode and quota must not throw into the click/render path.
  }
}

export function readStoredTheme(): ThemeName | null {
  try {
    const direct = localStorage.getItem('uniplan_theme');
    if (isThemeName(direct)) return direct;

    const raw = localStorage.getItem('uniplan_schedule_storage_v2');
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const state = 'state' in parsed ? parsed.state : undefined;
    if (typeof state !== 'object' || state === null) return null;
    const theme = 'theme' in state ? state.theme : undefined;
    return isThemeName(theme) ? theme : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  return (
    readStoredTheme() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}
