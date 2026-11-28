import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, rainBuckets, resolveWindow, seriesPoint, seriesStats, shiftAnchor, sumRange, summarise, timeTicks, zurichMidnight } from "./station-series";

const A = { id: "a", name: "Amriswil", lat: 47.55, lon: 9.32, source: "own" as const };
describe("Stationsverläufe", () => {
  it("Zürcher Mitternacht folgt Winter- und Sommerzeit", () => {
    assert.equal(new Date(zurichMidnight(2026, 11, 28)).toISOString(), "2026-11-27T23:00:00.000Z");
    assert.equal(new Date(zurichMidnight(2026, 7, 1)).toISOString(), "2026-06-30T22:00:00.000Z");
  });
  it("Tag zeigt Rohwerte von Mitternacht bis Mitternacht", () => {
    const w = resolveWindow("day", "2026-11-28");
    assert.equal(w.resolution, "raw");
    assert.equal(w.to - w.from, 24 * 3_600_000);
  });
  it("Monat zeigt Stundenwerte, Jahr Tageswerte", () => {
    const m = resolveWindow("month", "2026-11-28", "2026-02");
    assert.deepEqual([m.resolution, m.fromDay, m.toDay], ["hourly", "2026-02-01", "2026-02-28"]);
    const y = resolveWindow("year", "2026-11-28", "2024");
    assert.deepEqual([y.resolution, y.fromDay, y.toDay], ["daily", "2024-01-01", "2024-12-31"]);
  });
  it("freier Zeitraum: vertauschte Daten werden geordnet, die Auflösung folgt der Länge", () => {
    assert.equal(resolveWindow("custom", "2026-11-28", undefined, "2026-11-28", "2026-11-27").resolution, "raw");
    assert.equal(resolveWindow("custom", "2026-11-28", undefined, "2026-10-01", "2026-11-28").resolution, "hourly");
    const long = resolveWindow("custom", "2026-11-28", undefined, "2025-01-01", "2026-11-28");
    assert.deepEqual([long.resolution, long.fromDay, long.toDay], ["daily", "2025-01-01", "2026-11-28"]);
  });
  it("Blättern geht nie in die Zukunft", () => {
    assert.equal(shiftAnchor("day", "2026-11-28", 1, "2026-11-28"), "2026-11-28");
    assert.equal(shiftAnchor("day", "2026-03-01", -1, "2026-11-28"), "2026-02-28");
    assert.equal(shiftAnchor("month", "2026-01-15", -1, "2026-11-28"), "2025-12-01");
    assert.equal(shiftAnchor("year", "2026-06-01", -1, "2026-11-28"), "2025-01-01");
  });
  it("Wind kommt in m/s und wird km/h; negative Regenwerte fehlen", () => {
    const p = seriesPoint("raw", { measured_at: "2026-11-28T12:00:00+00:00", temperature: 3.3, wind_speed: 10, wind_gust: 20, rain_inc: -1 });
    assert.deepEqual([p?.temp, p?.wind, p?.gust, p?.rain], [3.3, 36, 72, null]);
    assert.equal(seriesPoint("raw", { measured_at: "kaputt" }), null);
  });
  it("Temperatur-Kennzahlen nutzen Stundenminimum und -maximum", () => {
    const base = { dew: null, hum: null, pres: null, wind: null, gust: null, dir: null, rain: null };
    const s = seriesStats([{ ...base, t: 1, temp: 2, tmin: -1, tmax: 4 }, { ...base, t: 2, temp: 4, tmin: 3, tmax: 6 }, { ...base, t: 3, temp: null, tmin: null, tmax: null }], "temperature");
    assert.deepEqual([s.avg, s.min, s.max, s.last, s.lastAt], [3, -1, 6, 4, 2]);
  });
  it("Regen: Stundenbalken mit laufender Summe nur bis zur letzten Messung", () => {
    const w = resolveWindow("day", "2026-11-28");
    const base = { temp: null, tmin: null, tmax: null, dew: null, hum: null, pres: null, wind: null, gust: null, dir: null };
    const b = rainBuckets([{ ...base, t: w.from + 600_000, rain: 0.4 }, { ...base, t: w.from + 1_200_000, rain: 0.6 }, { ...base, t: w.from + 3_600_000 * 2, rain: 2 }], w);
    assert.equal(b.length, 24);
    assert.deepEqual(b.slice(0, 4).map((x) => [x.label, x.rain, x.sum]), [["00 Uhr", 1, 1], ["01 Uhr", null, 1], ["02 Uhr", 2, 3], ["03 Uhr", null, null]]);
  });
  it("Achsenmarken: alle drei Stunden am Tag, Monatsanfänge im Jahr", () => {
    assert.equal(timeTicks(resolveWindow("day", "2026-11-28")).length, 9);
    assert.equal(timeTicks(resolveWindow("year", "2026-11-28")).length, 12);
  });
});

describe("Periodensummen", () => {
  it("Gestern und Monat ergeben die richtigen Tage", () => {
    assert.deepEqual(sumRange("yesterday", "2026-03-01"), { from: "2026-02-28", to: "2026-02-28" });
    assert.deepEqual(sumRange("month", "2026-11-28", "2024-02"), { from: "2024-02-01", to: "2024-02-29" });
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
  it("Regen wird summiert, die Temperatur gemittelt, die Böe ist die stärkste in km/h", () => {
    const [s] = summarise([A], [
      { station_id: "a", day: "2026-11-27", rain_sum: 2.5, temp_avg: 2, temp_min: -1, temp_max: 5, wind_max_gust: 10 },
      { station_id: "a", day: "2026-11-28", rain_sum: 1.5, temp_avg: 4, temp_min: 1, temp_max: 6, wind_max_gust: 5 },
      { station_id: "b", day: "2026-11-28", rain_sum: 99 },
    ]);
    assert.deepEqual([s?.rain, s?.tempAvg, s?.tempMin, s?.tempMax, s?.gust, s?.days], [4, 3, -1, 6, 36, 2]);
  });
  it("manuelle Tagessumme ersetzt die Messung und zählt auch ohne Messzeile", () => {
    const [s] = summarise([A], [{ station_id: "a", day: "2026-11-27", rain_sum: 2.5 }], [
      { station_id: "a", day: "2026-11-27", rain_sum: 6 }, { station_id: "a", day: "2026-11-28", rain_sum: "1.2" },
    ]);
    assert.equal(s?.rain, 7.2);
  });
  it("Station ohne Werte bleibt ohne Werte, nie null Millimeter", () => {
    const [s] = summarise([A], []);
    assert.deepEqual([s?.rain, s?.tempAvg, s?.gust], [null, null, null]);
  });
});
