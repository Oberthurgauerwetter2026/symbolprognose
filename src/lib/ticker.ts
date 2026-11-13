/** Ticker: Produktkatalog und reine Regeln (getestet). */
export const SITE = "https://oberthurgauer-wetter.lovable.app";

export interface TickerProduct { id: string; label: string; path: string; hint: string }

export const TICKER_PRODUCTS: TickerProduct[] = [
  { id: "regensumme", label: "Regensumme gefallen", path: "/karten/niederschlag", hint: "z. B. 24 h: bis 18 mm" },
  { id: "neuschnee", label: "Neuschnee gefallen", path: "/karten/niederschlag", hint: "z. B. 12 h: bis 15 cm" },
  { id: "regen-prognose", label: "Regensumme Prognose", path: "/karten/niederschlag", hint: "z. B. bis Sa: 25 mm" },
  { id: "schnee-prognose", label: "Neuschnee Prognose", path: "/karten/niederschlag", hint: "z. B. bis Sa: 10 cm" },
  { id: "radar", label: "Radar", path: "/karten/radar", hint: "z. B. Schauer ziehen ostwärts" },
  { id: "temperatur", label: "Temperatur", path: "/karten/region", hint: "z. B. Amriswil −3.4 °C" },
  { id: "wind", label: "Wind", path: "/karten/wind", hint: "z. B. Böen bis 75 km/h" },
  { id: "satellit", label: "Satellitenbild", path: "/karten/satellit", hint: "z. B. Hochnebel bis 900 m" },
  { id: "bodendruck", label: "Bodendruck", path: "/karten/bodendruck", hint: "z. B. Tief über der Nordsee" },
  { id: "warnungen", label: "Warnungen", path: "/karten/warnungen", hint: "z. B. Stufe 2 Glätte" },
  { id: "lokal", label: "Lokalprognose", path: "/karten/lokal", hint: "z. B. morgen sonnig, 8 °C" },
];

export const productById = (id: string | null | undefined) =>
  TICKER_PRODUCTS.find((p) => p.id === id) ?? null;

/** Ticker verschwindet, wenn die neueste Meldung älter als 24 h ist. */
export const TICKER_MAX_AGE_MS = 24 * 3600_000;
export const MAX_BODY = 280;

export function visiblePosts<T extends { created_at: string }>(posts: T[], nowMs: number): T[] {
  const sorted = [...posts].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!sorted.length || nowMs - Date.parse(sorted[0].created_at) > TICKER_MAX_AGE_MS) return [];
  return sorted;
}
