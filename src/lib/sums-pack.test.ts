import { describe, expect, it } from "vitest";
import { packDeep, unpackDeep } from "./sums-pack";

describe("sums-pack", () => {
  it("rundet auf 0.1 und behält -1 als fehlend", () => {
    const a = Array.from({ length: 20 }, (_, i) => (i === 3 ? -1 : i * 0.3));
    const out = unpackDeep<{ r: number[] }>(JSON.parse(JSON.stringify(packDeep({ r: a })))).r;
    expect(out[3]).toBe(-1);
    expect(out[1]).toBe(0.3);
    expect(out[19]).toBe(5.7);
  });
  it("lässt kurze Reihen und Texte unverändert", () => {
    const d = { gridLat: [46.9, 47.05], t: "x", n: null };
    expect(unpackDeep(packDeep(d))).toEqual(d);
  });
});
