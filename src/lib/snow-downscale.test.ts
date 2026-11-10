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
