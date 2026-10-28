export interface PickModifiers {
  shift?: boolean;
  ctrl?: boolean;
}

export interface PickResult {
  selected: Set<string>;
  anchor: string;
}

export interface PickOptions {
  /** Rows that a shift-range may not add (blocking errors, etc.). Direct clicks still toggle. */
  canSelect?: (id: string) => boolean;
  max?: number;
}

/** Event modifiers in the shape `applyPick` wants. Cmd counts as Ctrl so macOS works. */
export function pickModifiers(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): PickModifiers {
  return { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey };
}

/**
 * Click: toggle one row and move the anchor there. Ctrl/Cmd+click: the same, so a
 * row inside a shift-selected block can be unticked on its own. Shift+click: tick
 * every row between the anchor and the clicked row (in displayed order) and keep
 * the anchor, so repeated shift-clicks re-aim the same range.
 */
export function applyPick(
  selected: ReadonlySet<string>,
  orderedIds: readonly string[],
  anchor: string | null,
  id: string,
  mods: PickModifiers,
  { canSelect = () => true, max = Infinity }: PickOptions = {},
): PickResult {
  const next = new Set(selected);
  const from = anchor === null ? -1 : orderedIds.indexOf(anchor);
  const to = orderedIds.indexOf(id);

  if (mods.shift && !mods.ctrl && from !== -1 && to !== -1) {
    const step = to >= from ? 1 : -1;
    for (let i = from; i !== to + step; i += step) {
      const rowId = orderedIds[i];
      if (next.has(rowId) || !canSelect(rowId)) continue;
      if (next.size >= max) break;
      next.add(rowId);
    }
    return { selected: next, anchor: anchor as string };
  }

  if (next.has(id)) next.delete(id);
  else if (next.size < max) next.add(id);
  return { selected: next, anchor: id };
}
