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
  const darkTime = timeContrast(bg, DARK_TEXT);
  const lightTime = timeContrast(bg, LIGHT_TEXT);
  if (darkTime >= 4.5 || lightTime >= 4.5) {
    return darkTime >= lightTime ? DARK_TEXT : LIGHT_TEXT;
  }
  const dark = contrastRatio(TEXT_RGB[DARK_TEXT], bg);
  const light = contrastRatio(TEXT_RGB[LIGHT_TEXT], bg);
  return dark >= light ? DARK_TEXT : LIGHT_TEXT;
}

/** Time text is drawn at this opacity, so the block color has to clear 4.5:1 after blending. */
const TIME_TEXT_ALPHA = 0.85;

function timeContrast(bg: Rgb, text: CourseColorDisplay['text']): number {
  return contrastRatio(composite(TEXT_RGB[text], bg, TIME_TEXT_ALPHA), bg);
}

function displayFromRgb(bg: Rgb, border: Rgb): CourseColorDisplay {
  return {
    bg: toHex(bg),
    text: pickText(bg),
    border: toHex(border),
  };
}

function paint(bg: Rgb): CourseColorDisplay {
  const oklch = rgbToOklch(bg);
  const border = inGamutOklch({ ...oklch, l: Math.max(0.2, oklch.l - 0.08) }) ?? bg;
  return displayFromRgb(bg, border);
}

/**
 * Softened preset paints, keyed by the stored COURSE_COLORS hex.
 * Hues are spaced apart, and a few swatches sit darker so neighbors stay distinct.
 * None of these match the indigo accent or the conflict / Clear all reds.
 * The same hex is used in light and dark. Stored course colors are not rewritten.
 */
const PRESET_DISPLAY: Record<string, string> = {
  '#3b82f6': '#32A5D4',
  '#10b981': '#5AA75E',
  '#f97316': '#DE9046',
  '#8b5cf6': '#644395',
  '#ef4444': '#DAA0A0',
  '#f59e0b': '#D5B455',
  '#14b8a6': '#046850',
  '#ec4899': '#853867',
  '#84cc16': '#AABC56',
  '#f43f5e': '#D291CC',
  '#64748b': '#4E5359',
  '#c07d3e': '#885538',
};

const PRESET_PAINT = new Map<string, CourseColorDisplay>();
for (const hex of COURSE_COLORS) {
  const displayHex = PRESET_DISPLAY[hex.toLowerCase()];
  const rgb = displayHex ? parseHex(displayHex) : null;
  if (rgb) PRESET_PAINT.set(hex.toLowerCase(), paint(rgb));
}

/**
 * Preset swatches use the softened palette. Any other hex, including a custom
 * color from the picker, is painted exactly as stored in both themes.
 */
export function displayCourseColor(hex: string, _theme?: 'light' | 'dark'): CourseColorDisplay {
  const parsed = parseHex(hex || '');
  if (!parsed) return PRESET_PAINT.get('#3b82f6') ?? paint({ r: 50, g: 165, b: 212 });
  const preset = PRESET_PAINT.get(toHex(parsed).toLowerCase());
  if (preset) return preset;
  return paint(parsed);
}
