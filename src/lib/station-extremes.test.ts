import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXTREME_REFERENCE_STATIONS, parseStat, rankExtremes, stationExtremes, stationReadings, formatStationValue, zurichDay, compass, latestMeasuredAt, formatMeasuredTime } from "./station-extremes";
import { productById } from "./ticker";

const rows = [
  { id: "a", name: "Amriswil", lat: 0, lon: 0, min: -2.5, max: -1.4 },
  { id: "b", name: "Uttwil", lat: 0, lon: 0, min: 2.1, max: 3.2 },
  { id: "c", name: "Opfershofen", lat: 0, lon: 0, min: -3.1, max: null },
];
describe("Stations-Extremwerte", () => {
  it("Min: kälteste Station zuerst", () => assert.deepEqual(rankExtremes(rows, "min").map((r) => r.name), ["Opfershofen", "Amriswil", "Uttwil"]));
  it("Max: wärmste zuerst, Station ohne Wert fällt weg", () => assert.deepEqual(rankExtremes(rows, "max").map((r) => r.name), ["Uttwil", "Amriswil"]));
  it("unbekannter Parameter fällt auf Min", () => assert.equal(parseStat("x"), "min"));
  const dailyReadings = [
    { station_id: "11111111-1111-4111-8111-111111111111", temp_min: -0.5, temp_max: 2.1 },
    { station_id: "22222222-2222-4222-8222-222222222222", temp_min: -3.3, temp_max: 1.3 },
  ];
  it("Sitterdorf-Bischofszell verwendet auf beiden Karten die eigenen Tagesextreme", () => {
    const stations = stationExtremes(EXTREME_REFERENCE_STATIONS, dailyReadings);
    const id = "22222222-2222-4222-8222-222222222222";
    assert.equal(rankExtremes(stations, "min").find((s) => s.id === id)?.min, -3.3);
    assert.equal(rankExtremes(stations, "max").find((s) => s.id === id)?.max, 1.3);
    assert.deepEqual(stations.find((s) => s.id === id), { id, name: "Sitterdorf-Bischofszell", lat: 47.5104, lon: 9.2607, min: -3.3, max: 1.3 });
  });
  it("Güttingen verwendet auf beiden Karten die eigenen Tagesextreme", () => {
    const stations = stationExtremes(EXTREME_REFERENCE_STATIONS, dailyReadings);
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(rankExtremes(stations, "min").find((s) => s.id === id)?.min, -0.5);
    assert.equal(rankExtremes(stations, "max").find((s) => s.id === id)?.max, 2.1);
    assert.deepEqual(stations.find((s) => s.id === id), { id, name: "Güttingen", lat: 47.6019, lon: 9.2789, min: -0.5, max: 2.1 });
  });
  it("fehlende Tagesextreme werden nicht durch Livewerte oder Null ersetzt", () => {
    const stations = stationExtremes(EXTREME_REFERENCE_STATIONS, []);
    assert.deepEqual(rankExtremes(stations, "min"), []);
    assert.deepEqual(rankExtremes(stations, "max"), []);
  });
  it("Ticker bietet Tmin und Tmax als eigene Karten", () => {
    assert.equal(productById("temp-min")?.embed, "/embed/stationen-extrem?stat=min&clean=1");
    assert.equal(productById("temp-max")?.embed, "/embed/stationen-extrem?stat=max&clean=1");
  });
});

describe("Neue Stationskarten", () => {
  const now = Date.parse("2026-11-14T22:46:00Z");
  const id = EXTREME_REFERENCE_STATIONS[0].id;
  const daily = [{ station_id: id, temp_min: -3.3, temp_max: 5.2, wind_max_gust: 10, rain_sum: 12.4 }];
  it("aktuelle Temperatur kommt aus der jüngsten Messung, nicht aus Tagesextremen", () => {
    const rows = stationReadings(EXTREME_REFERENCE_STATIONS, daily, [
      { station_id: id, measured_at: "2026-11-14T22:40:00Z", temperature: 2.1 },
      { station_id: id, measured_at: "2026-11-14T22:30:00Z", temperature: 3.4 },
    ], now);
    assert.equal(rows[0].current, 2.1);
  });
  it("stärkste Tagesböe wird von m/s nach km/h umgerechnet", () => {
    const rows = stationReadings(EXTREME_REFERENCE_STATIONS, daily, [], now);
    assert.equal(rows[0].gust, 36);
    assert.equal(formatStationValue(rows[0].gust ?? -1, "gust"), "36 km/h");
  });
  it("Tagesniederschlag bleibt in mm, einschliesslich echtem Nullwert", () => {
    assert.equal(stationReadings(EXTREME_REFERENCE_STATIONS, daily, [], now)[0].rain, 12.4);
    assert.equal(stationReadings(EXTREME_REFERENCE_STATIONS, [{ ...daily[0], rain_sum: 0 }], [], now)[0].rain, 0);
    assert.equal(formatStationValue(12.4, "rain"), "12.4 mm");
  });
  it("alle drei Ansichten sind einzeln im Ticker auswählbar", () => {
    for (const [product, stat] of [["temp-current", "current"], ["gust-today", "gust"], ["rain-today", "rain"]]) {
      assert.equal(productById(product)?.embed, `/embed/stationen-extrem?stat=${stat}&clean=1`);
      assert.equal(parseStat(stat), stat);
    }
  });
  it("externe WordPress-Livekarte bleibt unverändert", () => {
    assert.equal(productById("hub-karte")?.embed, "https://live-wetterkarte.lovable.app/embed/map");
  });
  it("aktueller Wind: Böe in km/h mit Richtung, sonst Mittelwind; Regenrate in mm/h", () => {
    const live = { station_id: id, measured_at: "2026-11-14T22:40:00Z", temperature: 2, wind_speed: 2, wind_gust: 5, wind_dir: 82, rain_rate: 1.2 };
    const row = stationReadings(EXTREME_REFERENCE_STATIONS, daily, [live], now)[0];
    assert.equal(row.wind, 18);
    assert.equal(row.windDir, 82);
    assert.equal(row.rainRate, 1.2);
    assert.equal(row.source, "meteoswiss");
    assert.equal(row.measuredAt, "2026-11-14T22:40:00Z");
    assert.equal(stationReadings([{ id: "x", name: "Amriswil", lat: 47.5, lon: 9.3 }], [], [], now)[0].source, "own");
    assert.equal(compass(82), "O");
    assert.equal(compass(350), "N");
    assert.equal(formatStationValue(18, "wind"), "18 km/h");
    assert.equal(formatStationValue(1.2, "rainRate"), "1.2 mm/h");
    assert.equal(stationReadings(EXTREME_REFERENCE_STATIONS, daily, [{ ...live, wind_gust: null }], now)[0].wind, 7.2);
    const old = stationReadings(EXTREME_REFERENCE_STATIONS, daily, [{ ...live, measured_at: "2026-11-14T22:00:00Z" }], now)[0];
    assert.equal(old.wind, null);
    assert.equal(old.rainRate, null);
  });
  it("Messungen älter als 30 Minuten und fehlende Tageswerte bleiben leer", () => {
    const rows = stationReadings(EXTREME_REFERENCE_STATIONS, [], [{ station_id: id, measured_at: "2026-11-14T22:15:00Z", temperature: 8 }], now);
    assert.equal(rows[0].current, null);
    assert.equal(rows[0].gust, null);
    assert.equal(rows[0].rain, null);
  });
  it("der Tag wechselt um Mitternacht Zürich, nicht UTC", () => {
    assert.equal(zurichDay(Date.parse("2026-11-14T23:01:00Z")), "2026-11-15");
  });
  it("die Stand-Angabe nimmt die jüngste Messzeit, ohne Messung keine", () => {
    const base = { id: "a", name: "A", lat: 0, lon: 0, min: null, max: null };
    assert.equal(latestMeasuredAt([{ ...base, measuredAt: "2026-11-14T22:30:00Z" }, { ...base, measuredAt: "2026-11-14T22:40:00Z" }, { ...base, measuredAt: null }]), "2026-11-14T22:40:00Z");
    assert.equal(latestMeasuredAt([base, { ...base, measuredAt: null }]), null);
    assert.equal(formatMeasuredTime("2026-11-14T22:40:00Z"), "23:40");
  });
});
