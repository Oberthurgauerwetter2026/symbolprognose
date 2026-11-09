import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { attenuateRadarBand, nowcastIntensityFactor, displacementDeg, handoverBlends, isUsableMotion, nowcastSteps, tendencyImageUrl, nowcastPlacement } from "./radar-nowcast";
import { buildTimelineSteps } from "../components/maps/radar-playback";

const BBOX = { minLat: 47, maxLat: 48, minLon: 9, maxLon: 10 };

describe("radar nowcast", () => {
  test("nowcast keeps measured intensity, no artificial fade", () => {
    for (const lead of [0, 60, 65, 75, 120]) assert.equal(nowcastIntensityFactor(lead), 1);
  });
  test("attenuation still maps mm/h before colour selection", () => {
    const thresholds = [0.1, 0.3, 0.8, 2, 5, 15, 40, 80];
    assert.equal(attenuateRadarBand(5, 1, thresholds), 5);
    assert.equal(attenuateRadarBand(5, 0.4, thresholds), 4);
    assert.equal(attenuateRadarBand(1, 0.5, thresholds), 0);
  });
  test("observed tendency image matches measurement within one ingest cycle and exact target", () => {
    const source = Date.UTC(2026, 10, 1, 9, 25);
    const target = source + 5 * 60_000;
    const url = "https://weather.test/radar/nowcast/image.png";
    const frames = [{ t: new Date(target).toISOString(), sourceT: new Date(source).toISOString(), precipUrl: url }];
    assert.equal(tendencyImageUrl(frames, source, target), url);
    assert.equal(tendencyImageUrl(frames, source - 20 * 60_000, target), undefined);
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
  for (const [min, lastAt] of [[5, 115], [25, 115], [50, 175], [55, 175]] as const) {
    test(`Messung :${min} → Nowcast lückenlos bis :55 vor der Modellstunde nach 75 min`, () => {
      const steps = nowcastSteps(at(min), at(min) + 60_000, m, BBOX);
      assert.equal(steps[0].tMs, at(min + 5));
      assert.equal(steps[steps.length - 1].tMs, at(lastAt));
      for (let i = 1; i < steps.length; i++) assert.equal(steps[i].tMs - steps[i - 1].tMs, 5 * 60_000);
    });
  }

  test("08:55-Messung um 09:05 läuft bis 10:55, Modell nahtlos ab 11:00", () => {
    const atTime = (h: number, min: number) => Date.UTC(2026, 10, 1, h, min);
    const last = atTime(8, 55);
    const now = atTime(9, 5);
    const steps = nowcastSteps(last, now, m, BBOX);
    const expected = Array.from({ length: 22 }, (_, i) => atTime(9, 10 + i * 5));
    assert.deepEqual(steps.map((s) => s.tMs), expected);
    const frames = [
      { t: new Date(last).toISOString(), source: "radar" },
      ...steps.map((s) => ({ t: new Date(s.tMs).toISOString(), source: "nowcast" })),
      ...[11, 12].map((h) => ({ t: new Date(atTime(h, 0)).toISOString(), source: "icon-ch1" })),
    ];
    assert.deepEqual(buildTimelineSteps(frames, now), [last, ...expected, atTime(11, 0), atTime(12, 0)]);
  });

  test("bei 20 Minuten Messverzögerung endet der Nowcast um :55 vor der nächsten Stunde", () => {
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
    assert.equal(steps.length, 18);
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
