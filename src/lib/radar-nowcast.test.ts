import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { displacementDeg, handoverBlends, isUsableMotion, nowcastSteps, tendencyImageUrl } from "./radar-nowcast";
import { buildTimelineSteps } from "../components/maps/radar-playback";

const BBOX = { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 };

describe("radar nowcast", () => {
  test("observed tendency image matches exact measurement and five-minute target only", () => {
    const source = Date.UTC(2026, 10, 1, 9, 25);
    const target = source + 5 * 60_000;
    const url = "https://weather.test/radar/nowcast/image.png";
    const frames = [{ t: new Date(target).toISOString(), sourceT: new Date(source).toISOString(), precipUrl: url }];
    assert.equal(tendencyImageUrl(frames, source, target), url);
    assert.equal(tendencyImageUrl(frames, source - 5 * 60_000, target), undefined);
    assert.equal(tendencyImageUrl(frames, source, target + 5 * 60_000), undefined);
    assert.equal(tendencyImageUrl(undefined, source, target), undefined);
  });
  test("Westwind (aus 270°) verschiebt nach Osten", () => {
    const d = displacementDeg({ dirFromDeg: 270, kmh: 60 }, 60, 47.5);
    assert.ok(d.dLon > 0.75);
    assert.ok(Math.abs(d.dLat) < 1e-9);
  });

  const H = 3_600_000;
  const at = (min: number) => 1_000 * H + min * 60_000; // volle Stunde + min
  const m = { dirFromDeg: 270, kmh: 30 };
  for (const min of [5, 25, 50, 55]) {
    test(`Messung :${min} → 60 Minuten Nowcast, auch über die volle Stunde`, () => {
      const steps = nowcastSteps(at(min), at(min) + 60_000, m, BBOX);
      assert.equal(steps.length, 12);
      assert.equal(steps[11].tMs, at(min + 60));
      const n = 12;
      if (n > 1) assert.equal(steps[1].tMs - steps[0].tMs, 5 * 60_000);
    });
  }

  test("08:55-Messung um 09:05 überbrückt bis vor 10:00, mit korrekter Verlagerung und Zeitstreifen", () => {
    const atTime = (h: number, min: number) => Date.UTC(2026, 10, 1, h, min);
    const last = atTime(8, 55);
    const now = atTime(9, 5);
    const steps = nowcastSteps(last, now, m, BBOX);
    const expected = Array.from({ length: 10 }, (_, i) => atTime(9, 10 + i * 5));
    assert.deepEqual(steps.map((s) => s.tMs), expected);
    const displacement = displacementDeg(m, 15, 47.5);
    assert.equal(steps[0].bbox.minLon, BBOX.minLon + displacement.dLon);
    const frames = [
      { t: new Date(last).toISOString(), source: "radar" },
      ...steps.map((s) => ({ t: new Date(s.tMs).toISOString(), source: "nowcast" })),
      ...[10, 11].map((h) => ({ t: new Date(atTime(h, 0)).toISOString(), source: "icon-ch1" })),
    ];
    assert.deepEqual(buildTimelineSteps(frames, now), [last, ...expected, atTime(10, 0), atTime(11, 0)]);
  });

  test("am Stundenwechsel überbrückt eine 08:55-Messung um 09:00 ebenfalls bis vor 10:00", () => {
    const steps = nowcastSteps(at(-5), at(0), m, BBOX);
    assert.deepEqual(steps.map((s) => s.tMs), Array.from({ length: 11 }, (_, i) => at(5 + i * 5)));
  });

  test("auch bei genau 20 Minuten Messverzögerung endet der Nowcast vor der nächsten aktuellen Stunde", () => {
    const steps = nowcastSteps(at(-15), at(5), m, BBOX);
    assert.deepEqual(steps.map((s) => s.tMs), Array.from({ length: 10 }, (_, i) => at(10 + i * 5)));
  });

  test("kein Nowcast, wenn die letzte Messung älter als 20 Minuten ist", () => {
    const last = 1_000_000_000_000;
    assert.deepEqual(nowcastSteps(last, last + 21 * 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX), []);
  });

  test("quasi-stationärer Stauregen (0 km/h) ist ein brauchbarer Nowcast-Vektor", () => {
    const stationary = { dirFromDeg: 180, kmh: 0 };
    assert.ok(isUsableMotion(stationary));
    const steps = nowcastSteps(at(25), at(25) + 60_000, stationary, BBOX);
    assert.equal(steps.length, 12);
    // 0 km/h: Feld bleibt an Ort und Stelle stehen.
    for (const s of steps) {
      assert.equal(s.bbox.minLon, BBOX.minLon);
      assert.equal(s.bbox.minLat, BBOX.minLat);
    }
    assert.ok(!isUsableMotion({ dirFromDeg: 180, kmh: -0.1 }));
    assert.ok(!isUsableMotion({ dirFromDeg: 180, kmh: 120 }));
  });
});

describe("handoverBlends", () => {
  test("fades the measured field over the first two model hours", () => {
    const last = Date.parse("2026-11-01T11:45:00Z");
    const hand = Date.parse("2026-11-01T12:00:00Z");
    const b = handoverBlends(last, hand, { dirFromDeg: 270, kmh: 30 }, { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 });
    assert.deepEqual(b.map((x) => x.weight), [0.6, 0.25]);
    assert.deepEqual(b.map((x) => x.tMs), [hand, hand + 3_600_000]);
    assert.ok(b[1].bbox.minLon > b[0].bbox.minLon);
  });
});
