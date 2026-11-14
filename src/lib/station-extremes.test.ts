import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXTREME_REFERENCE_STATIONS, parseStat, rankExtremes, stationExtremes } from "./station-extremes";
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
