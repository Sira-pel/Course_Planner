import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyPick, pickModifiers } from './rangeSelect';

const ids = ['a', 'b', 'c', 'd', 'e'];
const sorted = (set: Set<string>) => [...set].sort();

describe('range selection', () => {
  it('plain click toggles one row and sets the anchor', () => {
    const on = applyPick(new Set(), ids, null, 'b', {});
    assert.deepEqual(sorted(on.selected), ['b']);
    assert.equal(on.anchor, 'b');
    assert.deepEqual(sorted(applyPick(on.selected, ids, on.anchor, 'b', {}).selected), []);
  });

  it('shift+click ticks everything between the anchor and the click', () => {
    const first = applyPick(new Set(), ids, null, 'b', {});
    const range = applyPick(first.selected, ids, first.anchor, 'e', { shift: true });
    assert.deepEqual(sorted(range.selected), ['b', 'c', 'd', 'e']);
    assert.equal(range.anchor, 'b');
  });

  it('shift+click works upwards from the anchor', () => {
    const range = applyPick(new Set(['d']), ids, 'd', 'a', { shift: true });
    assert.deepEqual(sorted(range.selected), ['a', 'b', 'c', 'd']);
  });

  it('ctrl+click unticks one row inside a shift range', () => {
    const range = applyPick(new Set(['a']), ids, 'a', 'e', { shift: true });
    const hole = applyPick(range.selected, ids, range.anchor, 'c', { ctrl: true });
    assert.deepEqual(sorted(hole.selected), ['a', 'b', 'd', 'e']);
  });

  it('shift+click without an anchor behaves like a plain click', () => {
    assert.deepEqual(sorted(applyPick(new Set(), ids, null, 'c', { shift: true }).selected), ['c']);
    assert.deepEqual(sorted(applyPick(new Set(), ids, 'gone', 'c', { shift: true }).selected), ['c']);
  });

  it('ranges use the visible order only', () => {
    const visible = ['a', 'c', 'e'];
    const range = applyPick(new Set(['a']), visible, 'a', 'e', { shift: true });
    assert.deepEqual(sorted(range.selected), ['a', 'c', 'e']);
  });

  it('skips rows that cannot be selected', () => {
    const range = applyPick(new Set(['a']), ids, 'a', 'd', { shift: true }, { canSelect: (id) => id !== 'c' });
    assert.deepEqual(sorted(range.selected), ['a', 'b', 'd']);
  });

  it('stops at the cap', () => {
    const range = applyPick(new Set(['a']), ids, 'a', 'e', { shift: true }, { max: 3 });
    assert.deepEqual(sorted(range.selected), ['a', 'b', 'c']);
    assert.deepEqual(sorted(applyPick(new Set(['a', 'b', 'c']), ids, 'c', 'd', {}, { max: 3 }).selected), ['a', 'b', 'c']);
  });

  it('treats Cmd like Ctrl', () => {
    assert.deepEqual(pickModifiers({ shiftKey: false, ctrlKey: false, metaKey: true }), { shift: false, ctrl: true });
  });
});
