import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { displacementDeg, nowcastSteps } from "./radar-nowcast";

const BBOX = { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 };

describe("radar nowcast", () => {
  test("Westwind (aus 270°) verschiebt nach Osten", () => {
    const d = displacementDeg({ dirFromDeg: 270, kmh: 60 }, 60, 47.5);
    assert.ok(d.dLon > 0.75);
    assert.ok(Math.abs(d.dLat) < 1e-9);
  });

  const H = 3_600_000;
  const at = (min: number) => 1_000 * H + min * 60_000; // volle Stunde + min
  const m = { dirFromDeg: 270, kmh: 30 };
  for (const [min, n] of [[5, 10], [25, 6], [50, 1], [55, 0]] as const) {
    test(`Messung :${min} → ${n} Schritte bis vor die volle Stunde`, () => {
      const steps = nowcastSteps(at(min), at(min) + 60_000, m, BBOX);
      assert.equal(steps.length, n);
      for (const s of steps) assert.ok(s.tMs < 1_001 * H);
      if (n > 1) assert.equal(steps[1].tMs - steps[0].tMs, 5 * 60_000);
    });
  }

  test("kein Nowcast, wenn die letzte Messung älter als 20 Minuten ist", () => {
    const last = 1_000_000_000_000;
    assert.deepEqual(nowcastSteps(last, last + 21 * 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX), []);
  });
});
