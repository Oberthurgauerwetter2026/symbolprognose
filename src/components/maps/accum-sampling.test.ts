import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { sampleAccumCell } from "./accum-sampling";

// 5x5-Feld: eine Zelle liegt flächig auf der untersten Farbstufe (0.3 mm),
// ihr Umfeld fällt auf 0 ab. Die bikubische Seitenkeule rechnet dort in
// Zellenmitte auf −0.36 mm — die Zelle wird transparent: ringförmiges Loch.
const HOLE = [
  0.3, 0.3, 0.3, 0.3, 0.3,
  0,   0.3, 3,   3,   0,
  0.3, 3,   0.3, 0.3, 3,
  0,   3,   0.3, 0.3, 3,
  1,   1,   0.3, 3,   1,
];

describe("monotone accum sampling", () => {
  it("keeps a flat 0.3 mm cell visible where bicubic would punch a hole", () => {
    const v = sampleAccumCell(HOLE, 5, 5, 2, 2, 0.5, 0.5);
    assert.equal(v, 0.3, `cell centre ${v} — hole in the sums carpet`);
  });

  it("never falls below or above the four cell corners", () => {
    const grid = [
      0, 0.3, 0.3, 0,
      0.3, 5, 5, 0.3,
      0.3, 5, 5, 0.3,
      0, 0.3, 0.3, 0,
    ];
    for (let y0 = 0; y0 < 2; y0++) {
      for (let x0 = 0; x0 < 2; x0++) {
        const corners = [
          grid[y0 * 4 + x0],
          grid[y0 * 4 + x0 + 1],
          grid[(y0 + 1) * 4 + x0],
          grid[(y0 + 1) * 4 + x0 + 1],
        ];
        const lo = Math.min(...corners);
        const hi = Math.max(...corners);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const v = sampleAccumCell(grid, 4, 4, y0, x0, t, t);
          assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `cell ${y0}/${x0} t=${t} -> ${v} outside [${lo}, ${hi}]`);
        }
      }
    }
  });

  it("leaves uniform fields and strong cores unchanged", () => {
    assert.equal(sampleAccumCell(new Array(16).fill(0.3), 4, 4, 1, 1, 0.5, 0.5), 0.3);
    assert.equal(sampleAccumCell(new Array(16).fill(7.5), 4, 4, 1, 1, 0.37, 0.61), 7.5);
    assert.equal(sampleAccumCell(new Array(16).fill(0), 4, 4, 1, 1, 0.5, 0.5), 0);
  });

  it("stays smooth, not blocky, across a ramp", () => {
    const ramp = [0, 0, 0, 0, 0, 1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 0];
    const a = sampleAccumCell(ramp, 4, 4, 1, 1, 0.5, 0.5);
    const b = sampleAccumCell(ramp, 4, 4, 1, 1, 0.505, 0.5);
    assert.ok(a > 1 && a < 4, `ramp centre ${a} not between corner values`);
    assert.ok(Math.abs(a - b) < 0.02, `sampling steps discontinuously: ${a} -> ${b}`);
  });
});
