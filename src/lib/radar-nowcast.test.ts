import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { attenuateRadarBand, nowcastIntensityFactor, displacementDeg, handoverBlends, isUsableMotion, nowcastSteps, tendencyImageUrl, nowcastPlacement } from "./radar-nowcast";
import { buildTimelineSteps } from "../components/maps/radar-playback";

const BBOX = { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 };

describe("radar nowcast", () => {
  test("intensity is unchanged through minute 60 and smoothly vanishes at 75", () => {
    assert.equal(nowcastIntensityFactor(0), 1);
    assert.equal(nowcastIntensityFactor(60), 1);
    assert.equal(nowcastIntensityFactor(65), 20 / 27);
    assert.equal(nowcastIntensityFactor(67.5), 0.5);
    assert.ok(Math.abs(nowcastIntensityFactor(70) - 7 / 27) < 1e-12);
    assert.equal(nowcastIntensityFactor(75), 0);
    assert.equal(nowcastIntensityFactor(80), 0);
  });
  test("tail reduces mm/h before colour selection, without dimming or inventing dry pixels", () => {
    const thresholds = [0.1, 0.3, 0.8, 2, 5, 15, 40, 80];
    assert.equal(attenuateRadarBand(5, 1, thresholds), 5);
    assert.equal(attenuateRadarBand(5, 0.4, thresholds), 4); // 5 -> 2 mm/h
    assert.equal(attenuateRadarBand(1, 0.5, thresholds), 0); // below 0.1 mm/h
    assert.equal(attenuateRadarBand(8, nowcastIntensityFactor(75), thresholds), 0);
    assert.equal(attenuateRadarBand(0, 0.5, thresholds), 0);
  });
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
    test(`Messung :${min} → 75 Minuten Nowcast, auch über die volle Stunde`, () => {
      const steps = nowcastSteps(at(min), at(min) + 60_000, m, BBOX);
      assert.equal(steps.length, 15);
      assert.equal(steps[14].tMs, at(min + 75));
      const n = 15;
      if (n > 1) assert.equal(steps[1].tMs - steps[0].tMs, 5 * 60_000);
    });
  }

  test("08:55-Messung um 09:05 läuft bis 10:10, erst danach Modell und komprimierter Zeitstreifen", () => {
    const atTime = (h: number, min: number) => Date.UTC(2026, 10, 1, h, min);
    const last = atTime(8, 55);
    const now = atTime(9, 5);
    const steps = nowcastSteps(last, now, m, BBOX);
    const expected = Array.from({ length: 13 }, (_, i) => atTime(9, 10 + i * 5));
    assert.deepEqual(steps.map((s) => s.tMs), expected);
    const displacement = displacementDeg(m, 15, 47.5);
    assert.equal(steps[0].bbox.minLon, BBOX.minLon + displacement.dLon);
    const frames = [
      { t: new Date(last).toISOString(), source: "radar" },
      ...steps.map((s) => ({ t: new Date(s.tMs).toISOString(), source: "nowcast" })),
      ...[11, 12].map((h) => ({ t: new Date(atTime(h, 0)).toISOString(), source: "icon-ch1" })),
    ];
    assert.deepEqual(buildTimelineSteps(frames, now), [last, ...expected, atTime(11, 0), atTime(12, 0)]);
  });

  test("am Stundenwechsel läuft eine 08:55-Messung um 09:00 bis 10:10", () => {
    const steps = nowcastSteps(at(-5), at(0), m, BBOX);
    assert.deepEqual(steps.map((s) => s.tMs), Array.from({ length: 14 }, (_, i) => at(5 + i * 5)));
  });

  test("auch bei genau 20 Minuten Messverzögerung läuft der Nowcast 75 Minuten ab Messung", () => {
    const steps = nowcastSteps(at(-15), at(5), m, BBOX);
    assert.deepEqual(steps.map((s) => s.tMs), Array.from({ length: 11 }, (_, i) => at(10 + i * 5)));
  });

  test("kein Nowcast, wenn die letzte Messung älter als 20 Minuten ist", () => {
    const last = 1_000_000_000_000;
    assert.deepEqual(nowcastSteps(last, last + 21 * 60_000, { dirFromDeg: 270, kmh: 30 }, BBOX), []);
  });

  test("quasi-stationärer Stauregen (0 km/h) ist ein brauchbarer Nowcast-Vektor", () => {
    const stationary = { dirFromDeg: 180, kmh: 0 };
    assert.ok(isUsableMotion(stationary));
    const steps = nowcastSteps(at(25), at(25) + 60_000, stationary, BBOX);
    assert.equal(steps.length, 15);
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

describe("nowcastPlacement", () => {
  const a = { minLat: 1, maxLat: 2, minLon: 3, maxLon: 4 };
  const b = { minLat: 1.1, maxLat: 2.1, minLon: 3.1, maxLon: 4.1 };
  test("advected images stay in place", () => assert.deepEqual(nowcastPlacement({ advected: true }, b, a), a));
  test("legacy images are shifted", () => {
    assert.deepEqual(nowcastPlacement({}, b, a), b);
    assert.deepEqual(nowcastPlacement(undefined, b, a), b);
  });
});

import { tendencyFrame } from "./radar-nowcast";
test("tendencyFrame toleriert 5 min Versatz zwischen Manifest und region-max", () => {
  const f = [{ t: "2026-11-06T16:30:00Z", sourceT: "2026-11-06T16:15:00Z", precipUrl: "https://x/a.png" }];
  assert.equal(tendencyFrame(f, Date.parse("2026-11-06T16:10:00Z"), Date.parse("2026-11-06T16:30:00Z")), f[0]);
  assert.equal(tendencyFrame(f, Date.parse("2026-11-06T15:50:00Z"), Date.parse("2026-11-06T16:30:00Z")), undefined);
});
