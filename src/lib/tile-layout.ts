import { z } from 'zod';

export const TILE_IDS = ['standort', 'radar', 'wind', 'warnungen', 'messwerte', 'ticker', 'bericht', 'news', 'satellit', 'summen', 'region', 'snowcast'] as const;
export type TileId = typeof TILE_IDS[number];
export const TILE_NAMES: Record<TileId, string> = { standort: 'Wetter am Standort', radar: 'Radar', wind: 'Windanimation', warnungen: 'Warnungen', messwerte: 'Live-Messwerte', ticker: 'Live-Ticker', bericht: 'Wetterbericht', news: 'News', satellit: 'Satellit', summen: 'Regen & Schnee', region: 'Regionsprognose', snowcast: 'SnowCast' };
export const tileSchema = z.object({ id: z.enum(TILE_IDS), visible: z.boolean(), width: z.enum(['small', 'half', 'full']) });
const tilesSchema = z.array(tileSchema).length(TILE_IDS.length).refine(items => new Set(items.map(item => item.id)).size === TILE_IDS.length);
export const layoutSchema = z.object({ version: z.literal(1), mobile: tilesSchema, desktop: tilesSchema });
export type Tile = z.infer<typeof tileSchema>;
export type TileLayout = z.infer<typeof layoutSchema>;
export type LayoutMode = 'mobile' | 'desktop';
export const LAYOUT_STORAGE = 'owt-tile-arrangement-v1';
export function defaultLayout(): TileLayout {
  const make = (mode: LayoutMode): Tile[] => TILE_IDS.map(id => ({ id, visible: true, width: ['standort', 'ticker', 'bericht', 'news'].includes(id) ? (mode === 'mobile' || id === 'standort' ? 'full' : 'half') : 'small' }));
  return { version: 1, mobile: make('mobile'), desktop: make('desktop') };
}
export function moveTile(tiles: Tile[], id: TileId, target: TileId): Tile[] {
  const from = tiles.findIndex(tile => tile.id === id);
  const to = tiles.findIndex(tile => tile.id === target);
  if (from < 0 || to < 0 || from === to) return tiles;
  const next = [...tiles];
  const [item] = next.splice(from, 1);
  if (!item) return tiles;
  next.splice(to, 0, item);
  return next;
}