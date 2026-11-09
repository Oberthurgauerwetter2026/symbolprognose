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
