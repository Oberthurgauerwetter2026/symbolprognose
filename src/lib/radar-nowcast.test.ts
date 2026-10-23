import { describe, expect, it } from "vitest";
import { displacementDeg, nowcastSteps } from "./radar-nowcast";

const BBOX = { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 };

describe("radar nowcast", () => {
  it("Westwind (aus 270°) verschiebt nach Osten", () => {
    const d = displacementDeg({ dirFromDeg: 270, kmh: 60 }, 60, 47.5);
    expect(d.dLon).toBeGreaterThan(0.75);
    expect(Math.abs(d.dLat)).toBeLessThan(1e-9);
  });

  it("liefert 5-Minuten-Schritte bis +60 Minuten", () => {
    const last = 1_000_000_000_000;
    const steps = nowcastSteps(last, last + 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX);
    expect(steps).toHaveLength(12);
    expect(steps[1].tMs - steps[0].tMs).toBe(5 * 60_000);
    expect(steps[11].tMs).toBe(last + 60 * 60_000);
  });

  it("kein Nowcast, wenn die letzte Messung älter als 20 Minuten ist", () => {
    const last = 1_000_000_000_000;
    expect(nowcastSteps(last, last + 21 * 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX)).toEqual([]);
  });
});
