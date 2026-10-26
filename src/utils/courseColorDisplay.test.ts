import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COURSE_COLORS, LEGACY_COURSE_COLOR_MAP } from '../types/schedule';
import { displayCourseColor } from './courseColorDisplay';
import { nextUnusedCourseColor, normalizeCourseColor } from './courseColor';

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
}

function linear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const ACCENT = '#4D5DE4';
const CONFLICT_RED = '#EF4444';

describe('course color palette', () => {
  it('keeps the 12 stored preset values so saved courses and the picker keep working', () => {
    assert.deepEqual(COURSE_COLORS, [
      '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EF4444', '#F59E0B',
      '#14B8A6', '#EC4899', '#84CC16', '#F43F5E', '#64748B', '#C07D3E',
    ]);
  });

  it('paints each preset in its own color with readable text', () => {
    const shown = COURSE_COLORS.map((hex) => displayCourseColor(hex));
    assert.equal(new Set(shown.map((item) => item.bg)).size, COURSE_COLORS.length);
    for (const item of shown) {
      assert.ok(contrast(item.text, item.bg) >= 4.5, `${item.bg} text ${item.text}`);
    }
  });

  it('keeps every pair of preset colors visibly different', () => {
    const shown = COURSE_COLORS.map((hex) => displayCourseColor(hex).bg);
    for (let i = 0; i < shown.length; i += 1) {
      for (let j = i + 1; j < shown.length; j += 1) {
        assert.ok(deltaE(shown[i], shown[j]) >= 25, `${shown[i]} vs ${shown[j]}`);
      }
    }
  });

  it('keeps presets away from the accent and the conflict red', () => {
    for (const hex of COURSE_COLORS) {
      const { bg } = displayCourseColor(hex);
      assert.ok(deltaE(bg, ACCENT) >= 25, `${bg} is too close to the accent`);
      assert.ok(deltaE(bg, CONFLICT_RED) >= 35, `${bg} is too close to the conflict red`);
    }
  });

  it('paints a custom color exactly as stored, so picking it again does not drift', () => {
    const first = displayCourseColor('#123456');
    assert.equal(first.bg, '#123456');
    assert.equal(displayCourseColor(first.bg).bg, first.bg);
  });

  it('still maps older saved shades onto the palette and cycles unused colors', () => {
    assert.equal(normalizeCourseColor('#2563EB'), '#3b82f6');
    assert.ok(Object.values(LEGACY_COURSE_COLOR_MAP).every((hex) => COURSE_COLORS.includes(hex)));
    assert.equal(nextUnusedCourseColor(['#3B82F6', '#10B981']), '#F97316');
  });
});
