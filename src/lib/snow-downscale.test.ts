import { test } from "node:test";
import assert from "node:assert/strict";
import { snowFraction, downscaleSnow, weightedSnowLineHm, DEM } from "./snow-downscale";

test("Schneefallgrenze 1000 m: Säntis-Höhe voll Schnee, Seebecken kein Schnee", () => {
  assert.equal(snowFraction(2500, 1000), 1);
  assert.equal(snowFraction(400, 1000), 0);
  assert.equal(snowFraction(1000, 1000), 0.5);
});

test("Gleiche Modellsumme ergibt Schnee nur auf hohem Gelände", () => {
  const dem = new Int16Array(DEM.w * DEM.h).fill(400);
  // Pixel bei 47.25 N / 9.34 E hoch setzen
  const row = Math.round(((DEM.maxLat - 47.25) / 2) * (DEM.h - 1));
  const col = Math.round(((9.34 - DEM.minLon) / 4.2) * (DEM.w - 1));
  dem[row * DEM.w + col] = 2500;
  const g = downscaleSnow([10, 10, 10, 10], [10, 10, 10, 10], [47.2, 47.3], [9.3, 9.4], dem);
  const at = (la: number, lo: number) => g.values[g.gridLat.indexOf(la) * g.gridLon.length + g.gridLon.indexOf(lo)];
  assert.equal(at(47.25, 9.34), 7);
  assert.equal(at(47.22, 9.31), 0);
});

test("Schneefallgrenze nur aus Stunden mit Niederschlag", () => {
  const h = 3600_000;
  assert.equal(weightedSnowLineHm([h, 2 * h], [0, 2], [3000, 1300], 0, 12), 10);
  assert.equal(weightedSnowLineHm([h], [0], [1300], 0, 12), -1);
});

test("Rückblick 12/24/48/72 h nutzt nur die historischen Stunden, nicht die Prognose", () => {
  const h = 3600_000;
  const now = 100 * h;
  const times = Array.from({ length: 172 }, (_, i) => (i + 1) * h);
  const precip = times.map(() => 1);
  const fzl = times.map((t) => t <= now ? 1300 : 3300);
  for (const hours of [12, 24, 48, 72]) {
    assert.equal(weightedSnowLineHm(times, precip, fzl, now, hours, false), 10);
    assert.equal(weightedSnowLineHm(times, precip, fzl, now, hours), 30);
  }
  assert.equal(weightedSnowLineHm([now - 12 * h, now], [100, 1], [3300, 1300], now, 12, false), 10);
});

test("Historischer Modell-Ersatz folgt dem Relief statt dem groben Schneegitter", () => {
  const h = 3600_000;
  const line = weightedSnowLineHm([h, 2 * h], [5, 5], [1300, 1300], 2 * h, 12, false);
  const dem = new Int16Array(DEM.w * DEM.h).fill(400);
  const row = Math.round(((DEM.maxLat - 47.25) / 2) * (DEM.h - 1));
  const col = Math.round(((9.34 - DEM.minLon) / 4.2) * (DEM.w - 1));
  dem[row * DEM.w + col] = 2500;
  const g = downscaleSnow([10, 10, 10, 10], [line, line, line, line], [47.2, 47.3], [9.3, 9.4], dem);
  const at = (la: number, lo: number) => g.values[g.gridLat.indexOf(la) * g.gridLon.length + g.gridLon.indexOf(lo)];
  assert.equal(at(47.25, 9.34), 7);
  assert.equal(at(47.22, 9.31), 0);
});

test("Fehlende historische Nullgradgrenze erfindet keinen Schnee", () => {
  const h = 3600_000;
  assert.equal(weightedSnowLineHm([h, 2 * h], [1, 1], [null, 1300], 2 * h, 12, false), -1);
  const dem = new Int16Array(DEM.w * DEM.h).fill(2500);
  const g = downscaleSnow([10, 10, 10, 10], [-1, -1, -1, -1], [47.2, 47.3], [9.3, 9.4], dem);
  assert.ok(g.values.every((v) => v === -1));
  const dry = downscaleSnow([0, 0, 0, 0], [-1, -1, -1, -1], [47.2, 47.3], [9.3, 9.4], dem);
  assert.ok(dry.values.every((v) => v === 0));
});
