import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { visiblePosts } from "./ticker";
const now = Date.parse("2026-11-13T20:00:00Z");
const at = (h: number) => ({ created_at: new Date(now - h * 3600_000).toISOString() });
describe("visiblePosts", () => {
  it("neueste Meldung zuerst", () => {
    const r = visiblePosts([at(5), at(1), at(3)], now);
    assert.deepEqual(r.map((p) => p.created_at), [at(1), at(3), at(5)].map((p) => p.created_at));
  });
  it("Ticker verschwindet, wenn neueste Meldung älter als 24 h", () => {
    assert.equal(visiblePosts([at(25), at(30)], now).length, 0);
  });
  it("bleibt sichtbar bei 23 h", () => {
    assert.equal(visiblePosts([at(23)], now).length, 1);
  });
});

import { productById as _pb, TICKER_PRODUCTS as _all } from "./ticker";
describe("ticker catalog", () => {
  it("hat jede Summenkarte 12/24/48/72 h einzeln", () => {
    for (const h of [12, 24, 48, 72]) assert.equal(_pb(`snow-future-${h}`)?.path, `/karten/niederschlag?p=future&m=snow&h=${h}`);
    assert.equal(_all.filter((p) => p.path.includes("niederschlag")).length, 16);
  });
  it("alte Produkt-IDs bleiben gültig", () => assert.equal(_pb("regensumme")?.id, "rain-past-24"));
});
