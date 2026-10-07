import { COURSE_COLORS } from '../types/schedule';

export interface CourseColorDisplay {
  bg: string;
  text: '#ffffff' | '#0f172a';
  border: string;
}

const DARK_TEXT = '#0f172a';
const LIGHT_TEXT = '#ffffff';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseHex(hex: string): Rgb | null {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((char) => char + char).join('');
  }
  if (clean.length < 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
  return { r, g, b };
}

function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
  return `#${channel(r / 255)}${channel(g / 255)}${channel(b / 255)}`.toUpperCase();
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const c = clamp01(channel);
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(encoded) * 255);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
  };
}

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function oklchToRgb({ l, c, h }: Oklch): Rgb | null {
  const hue = (h * Math.PI) / 180;
  const A = Math.cos(hue) * c;
  const B = Math.sin(hue) * c;
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const b = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  if (r < -0.001 || g < -0.001 || b < -0.001 || r > 1.001 || g > 1.001 || b > 1.001) return null;
  return {
    r: linearToSrgb(r),
    g: linearToSrgb(g),
    b: linearToSrgb(b),
  };
}

function inGamutOklch(color: Oklch): Rgb | null {
  let chroma = color.c;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const rgb = oklchToRgb({ ...color, c: chroma });
    if (rgb) return rgb;
    chroma *= 0.85;
  }
  return oklchToRgb({ ...color, c: 0 });
}

const TEXT_RGB: Record<CourseColorDisplay['text'], Rgb> = {
  '#ffffff': { r: 255, g: 255, b: 255 },
  '#0f172a': { r: 15, g: 23, b: 42 },
};

function pickText(bg: Rgb): CourseColorDisplay['text'] {
  const dark = contrastRatio(TEXT_RGB[DARK_TEXT], bg);
  const light = contrastRatio(TEXT_RGB[LIGHT_TEXT], bg);
  if (dark >= 4.5 && light >= 4.5) return dark >= light ? DARK_TEXT : LIGHT_TEXT;
  if (dark >= 4.5) return DARK_TEXT;
  if (light >= 4.5) return LIGHT_TEXT;
  return dark >= light ? DARK_TEXT : LIGHT_TEXT;
}

/** Time text is drawn at this opacity, so the block color has to clear 4.5:1 after blending. */
const TIME_TEXT_ALPHA = 0.85;

function timeContrast(bg: Rgb, text: CourseColorDisplay['text']): number {
  return contrastRatio(composite(TEXT_RGB[text], bg, TIME_TEXT_ALPHA), bg);
}

function balancedDarkRgb(source: Rgb): Rgb {
  const oklch = rgbToOklch(source);
  // Cap vivid colors so the set shares one chroma band. Leave already-quiet
  // colors (the slate swatch) alone so they do not pick up a false hue.
  const chroma = Math.min(0.13, oklch.c);
  let best: Rgb = source;
  let bestScore = -1;
  for (let lightness = 0.5; lightness <= 0.72; lightness += 0.01) {
    const rgb = inGamutOklch({ l: lightness, c: chroma, h: oklch.h });
    if (!rgb) continue;
    const text = pickText(rgb);
    const score = timeContrast(rgb, text);
    const nearTarget = 1 - Math.abs(lightness - 0.62);
    const ranked = score + nearTarget * 0.05;
    if (score >= 4.5 && ranked > bestScore) {
      best = rgb;
      bestScore = ranked;
    }
  }
  if (bestScore >= 0) return best;
  const fallback = inGamutOklch({ l: 0.62, c: chroma, h: oklch.h });
  return fallback ?? source;
}

function displayFromRgb(bg: Rgb, border: Rgb): CourseColorDisplay {
  return {
    bg: toHex(bg),
    text: pickText(bg),
    border: toHex(border),
  };
}

const DARK_PALETTE = new Map<string, CourseColorDisplay>();
for (const hex of COURSE_COLORS) {
  const rgb = parseHex(hex);
  if (!rgb) continue;
  const bg = balancedDarkRgb(rgb);
  const border = inGamutOklch({ ...rgbToOklch(bg), l: Math.max(0.42, rgbToOklch(bg).l - 0.08) }) ?? bg;
  DARK_PALETTE.set(hex.toLowerCase(), displayFromRgb(bg, border));
}

function balancedDisplay(source: Rgb): CourseColorDisplay {
  const bg = balancedDarkRgb(source);
  const oklch = rgbToOklch(bg);
  const border = inGamutOklch({ ...oklch, l: Math.max(0.42, oklch.l - 0.08) }) ?? bg;
  return displayFromRgb(bg, border);
}

/**
 * Light and dark paint the same block color: the even, darker palette.
 * Stored hexes stay as palette keys and are not rewritten.
 */
export function displayCourseColor(hex: string, _theme?: 'light' | 'dark'): CourseColorDisplay {
  const parsed = parseHex(hex || '');
  if (!parsed) return DARK_PALETTE.get('#3b82f6') ?? balancedDisplay({ r: 59, g: 130, b: 246 });
  const known = DARK_PALETTE.get(toHex(parsed).toLowerCase());
  if (known) return known;
  return balancedDisplay(parsed);
}
