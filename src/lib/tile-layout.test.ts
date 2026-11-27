import { describe, expect, it } from 'vitest';
import { defaultLayout, layoutSchema, moveTile } from './tile-layout';

describe('tile arrangement', () => {
  it('moves the chosen tile to the chosen position without losing tiles', () => {
    const tiles = defaultLayout().mobile;
    const moved = moveTile(tiles, 'news', 'radar');
    expect(moved[1]?.id).toBe('news');
    expect(new Set(moved.map(t => t.id)).size).toBe(12);
    expect(tiles[1]?.id).toBe('radar');
  });
  it('keeps phone and desktop arrangements independent', () => {
    const layout = defaultLayout();
    layout.mobile = moveTile(layout.mobile, 'ticker', 'standort');
    expect(layout.mobile[0]?.id).toBe('ticker');
    expect(layout.desktop[0]?.id).toBe('standort');
  });
  it('rejects a saved arrangement with duplicate tiles', () => {
    const layout = defaultLayout();
    const first = layout.mobile[0];
    if (!first) throw new Error('Missing first tile');
    layout.mobile[1] = first;
    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });
});