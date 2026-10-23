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

  test("liefert 5-Minuten-Schritte bis +60 Minuten", () => {
    const last = 1_000_000_000_000;
    const steps = nowcastSteps(last, last + 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX);
    assert.equal(steps.length, 12);
    assert.equal(steps[1].tMs - steps[0].tMs, 5 * 60_000);
    assert.equal(steps[11].tMs, last + 60 * 60_000);
  });

  test("kein Nowcast, wenn die letzte Messung älter als 20 Minuten ist", () => {
    const last = 1_000_000_000_000;
    assert.deepEqual(nowcastSteps(last, last + 21 * 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX), []);
  });
});
