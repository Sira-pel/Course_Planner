import { reportStorageWriteFailure } from '../store/storageWrite';

export type ThemeName = 'light' | 'dark';
export type ThemePreference = ThemeName | 'system';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(preference: ThemePreference): ThemeName {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyDomTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  // Sync the mobile browser status bar and PWA title bar color with active theme
  const meta = document.getElementById('theme-color-meta');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#070707' : '#f7f8fb');
  }
}

export function persistTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem('uniplan_theme', theme);
  } catch (error) {
    // Private mode and quota must not throw into the click/render path.
    reportStorageWriteFailure(error);
  }
}

/** Explicit light/dark from storage. `system` returns null so callers follow the OS. */
export function readStoredTheme(): ThemeName | null {
  try {
    const direct = localStorage.getItem('uniplan_theme');
    if (direct === 'system') return null;
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

export function readStoredThemePreference(): ThemePreference | null {
  try {
    const direct = localStorage.getItem('uniplan_theme');
    return isThemePreference(direct) ? direct : null;
  } catch {
    return null;
  }
}

export function readInitialThemePreference(): ThemePreference {
  const direct = readStoredThemePreference();
  if (direct) return direct;
  return readStoredTheme() ?? 'system';
}

export function resolveInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  return resolveTheme(readInitialThemePreference());
}
