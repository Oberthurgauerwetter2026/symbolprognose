/** Ticker: Produktkatalog und reine Regeln (getestet). */
export const SITE = "https://oberthurgauer-wetter.lovable.app";

export interface TickerProduct { id: string; label: string; group: string; path: string; hint: string; embed?: string; image?: string }

const HUB = "https://live-wetterkarte.lovable.app";
const AMR = "https://oberthurgauerwetter2026.lovable.app";
const W = [12, 24, 48, 72] as const;
const sums = (m: "rain" | "snow", p: "past" | "future", name: string, hint: string): TickerProduct[] =>
  W.map((h) => ({ id: `${m}-${p}-${h}`, label: `${name} ${h} h`, group: `${name}`, path: `/karten/niederschlag?p=${p}&m=${m}&h=${h}`, embed: `/embed/niederschlag?p=${p}&m=${m}&h=${h}`, hint }));

/** Alle Karten aus allen Projekten. Pfade mit https:// verlinken direkt in andere Projekte. */
export const TICKER_PRODUCTS: TickerProduct[] = [
  ...sums("rain", "past", "Regensumme gefallen", "z. B. bis 18 mm"),
  ...sums("snow", "past", "Neuschnee gefallen", "z. B. bis 15 cm"),
  ...sums("rain", "future", "Regensumme Prognose", "z. B. bis 25 mm"),
  ...sums("snow", "future", "Neuschnee Prognose", "z. B. bis 10 cm"),
  { id: "radar", label: "Radar", group: "Karten", path: "/karten/radar", embed: "/embed/radar",  hint: "z. B. Schauer ziehen ostwärts" },
  { id: "temperatur", label: "Regionskarte", group: "Karten", path: "/karten/region", embed: "/embed/region",  hint: "z. B. Amriswil −3.4 °C" },
  { id: "wind", label: "Wind", group: "Karten", path: "/karten/wind", embed: "/embed/wind",  hint: "z. B. Böen bis 75 km/h" },
  { id: "satellit", label: "Satellitenbild", group: "Karten", path: "/karten/satellit", embed: "/embed/satellit",  hint: "z. B. Hochnebel bis 900 m" },
  { id: "bodendruck", label: "Bodendruck", group: "Karten", path: "/karten/bodendruck", image: AMR + "/api/public/maps/europe-pressure-latest.svg",  hint: "z. B. Tief über der Nordsee" },
  { id: "warnungen", label: "Warnungen", group: "Karten", path: "/karten/warnungen", embed: "/embed/warnungen",  hint: "z. B. Stufe 2 Glätte" },
  { id: "lokal", label: "Lokalprognose", group: "Karten", path: "/karten/lokal", embed: "/embed/lokalprognose",  hint: "z. B. morgen sonnig, 8 °C" },
  { id: "hub-karte", label: "Live-Stationskarte", group: "Weather Hub", path: HUB + "/", embed: HUB + "/",  hint: "z. B. Amriswil 2.1 °C" },
  { id: "hub-summen", label: "Stations-Summenkarte", group: "Weather Hub", path: HUB + "/summenkarte", embed: HUB + "/summenkarte",  hint: "z. B. 24 h: bis 12 mm" },
  { id: "hub-dashboard", label: "Stations-Dashboard", group: "Weather Hub", path: HUB + "/dashboard", embed: HUB + "/dashboard",  hint: "z. B. Böen 68 km/h" },
  { id: "amr-prognose", label: "Amriswil 10-Tage", group: "Amriswil Weather Watch", path: AMR + "/", embed: AMR + "/",  hint: "z. B. ab Sonntag kälter" },
];

const LEGACY: Record<string, string> = {
  regensumme: "rain-past-24", neuschnee: "snow-past-24", "regen-prognose": "rain-future-24", "schnee-prognose": "snow-future-24",
};
export const productUrl = (p: TickerProduct) => (p.path.startsWith("http") ? p.path : SITE + p.path);
/** Live-Vorschau: Bild-URL oder einbettbare Seite. */
export const productPreview = (p: TickerProduct) =>
  p.image ? { kind: "image" as const, src: p.image } : p.embed ? { kind: "frame" as const, src: p.embed.startsWith("http") ? p.embed : SITE + p.embed } : null;
export const productGroups = () => [...new Set(TICKER_PRODUCTS.map((p) => p.group))];

export const productById = (id: string | null | undefined) =>
  TICKER_PRODUCTS.find((p) => p.id === (LEGACY[id ?? ""] ?? id)) ?? null;

/** Ticker verschwindet, wenn die neueste Meldung älter als 24 h ist. */
export const TICKER_MAX_AGE_MS = 24 * 3600_000;
export const MAX_BODY = 280;

export function visiblePosts<T extends { created_at: string }>(posts: T[], nowMs: number): T[] {
  const sorted = [...posts].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!sorted.length || nowMs - Date.parse(sorted[0].created_at) > TICKER_MAX_AGE_MS) return [];
  return sorted;
}
