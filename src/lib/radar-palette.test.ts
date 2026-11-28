import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE, EMBED_DISPLAY_SCALE, SCALE } from './radar-palette';

describe('Radar display palette isolation', () => {
  it('retains the original embed palette and all other rain bands', () => {
    expect(EMBED_DISPLAY_SCALE[0]?.rgb).toEqual([134, 188, 236]);
    expect(DISPLAY_SCALE.slice(1)).toEqual(EMBED_DISPLAY_SCALE.slice(1));
  });

  it('retains the original PNG decoding reference', () => {
    expect(SCALE[0]).toEqual({ mmh: 0.1, rgb: [120, 180, 235], a: 245 / 255 });
  });
});