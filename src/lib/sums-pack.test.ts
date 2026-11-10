import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { packDeep, unpackDeep } from "./sums-pack";

describe("sums-pack", () => {
  it("rundet auf 0.1 und behält -1 als fehlend", () => {
    const a = Array.from({ length: 20 }, (_, i) => (i === 3 ? -1 : i * 0.3));
    const out = unpackDeep<{ r: number[] }>(JSON.parse(JSON.stringify(packDeep({ r: a })))).r;
    assert.equal(out[3], -1);
    assert.equal(out[1], 0.3);
    assert.equal(out[19], 5.7);
  });
  it("lässt kurze Reihen und Texte unverändert", () => {
    const d = { gridLat: [46.9, 47.05], t: "x", n: null };
    assert.deepEqual(unpackDeep(packDeep(d)), d);
  });
});

import { packDeep as _pd, unpackDeep as _ud } from "./sums-pack";
import { test as _t, expect as _e } from "vitest";
_t("grid axes keep full 0.01° precision", () => {
  const gridLat = Array.from({ length: 121 }, (_, i) => +(46.9 + i * 0.01).toFixed(2));
  const out = _ud<{ radar: { gridLat: number[] } }>(JSON.parse(JSON.stringify(_pd({ radar: { gridLat } }))));
  _e(out.radar.gridLat[1]).toBe(46.91);
  _e(new Set(out.radar.gridLat).size).toBe(121);
});
