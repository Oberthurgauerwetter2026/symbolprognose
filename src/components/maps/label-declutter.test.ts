import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  cityLabelWidth,
  declutterLabels,
  peakLabelWidth,
  PEAK_ANCHOR_X,
  PEAK_ANCHOR_Y,
  type DeclutterCandidate,
} from "./label-declutter";

type Place = { name: string; lat: number; lon: number };

function cand(
  name: string,
  lat: number,
  lon: number,
  priority: number,
  width = 40,
  anchorX?: number,
): DeclutterCandidate<Place> {
  return { item: { name, lat, lon }, lat, lon, width, priority, anchorX };
}

describe("map label decluttering", () => {
  it("keeps labels that are clearly apart", () => {
    const kept = declutterLabels(
      [cand("Zürich", 47.3769, 8.5417, 0), cand("Ulm", 48.4011, 9.9876, 0)],
      9,
    );
    assert.deepEqual(
      kept.map((k) => k.name),
      ["Zürich", "Ulm"],
    );
  });

  it("drops the less important label of two overlapping ones", () => {
    const kept = declutterLabels(
      [cand("Wangen", 47.6843, 9.9477, 2), cand("Tettnang", 47.686, 9.949, 3)],
      9,
    );
    assert.deepEqual(
      kept.map((k) => k.name),
      ["Wangen"],
    );
  });

  it("respects the label width, not just the anchor point", () => {
    // Gleiches Höhenband, Abstand knapp unter der Breite des langen Labels.
    const wide = declutterLabels(
      [
        cand("Friedrichshafen", 47.6539, 9.4794, 2, cityLabelWidth("Friedrichshafen", "medium")),
        cand("Ravensburg", 47.6539, 9.6163, 2),
      ],
      9,
    );
    assert.deepEqual(wide.map((k) => k.name), ["Friedrichshafen"]);

    // Gleiche Pairing, aber das breite Label links ist deutlich kürzer.
    const narrow = declutterLabels(
      [
        cand("Wil", 47.6539, 9.4794, 2, cityLabelWidth("Wil", "medium")),
        cand("Ravensburg", 47.6539, 9.6163, 2),
      ],
      9,
    );
    assert.deepEqual(
      narrow.map((k) => k.name),
      ["Wil", "Ravensburg"],
    );
  });

  it("shows more names when the map is zoomed in", () => {
    const pair = [
      cand("Säntis", 47.2493, 9.3433, 1, peakLabelWidth("Säntis", 2502)),
      cand("Gais", 47.2493, 9.4933, 2, cityLabelWidth("Gais", "local")),
    ];
    assert.equal(declutterLabels(pair, 8).length, 1);
    assert.equal(declutterLabels(pair, 11).length, 2);
  });

  it("returns the surviving labels in input order and stays deterministic", () => {
    const items = [
      cand("Kempten", 47.715, 10.3214, 2),
      cand("Isny", 47.5833, 10.0333, 2),
      cand("Memmingen", 47.9872, 10.1891, 2),
    ];
    const kept = declutterLabels(items, 9);
    assert.deepEqual(
      kept.map((k) => k.name),
      ["Kempten", "Isny", "Memmingen"],
    );
    assert.deepEqual(declutterLabels(items, 9), kept);
  });

  it("keeps a peak that is shifted past its crowded neighbours", () => {
    // Frauenfeld, Ottenberg und Romanshorn liegen im Standardfokus (Zoom 9)
    // beinahe auf einer Linie: ohne Versatz fiele der Ottenberg raus.
    const women = cand(
      "Frauenfeld",
      47.5578,
      8.8989,
      1,
      cityLabelWidth("Frauenfeld", "medium"),
    );
    const romanshorn = cand(
      "Romanshorn",
      47.56545,
      9.3776,
      3,
      cityLabelWidth("Romanshorn", "local"),
    );
    const ohneVersatz = cand(
      "Ottenberg",
      47.5826,
      9.1377,
      2,
      peakLabelWidth("Ottenberg", 680),
    );
    const mitVersatz = {
      ...ohneVersatz,
      anchorX: PEAK_ANCHOR_X + 16,
      anchorY: PEAK_ANCHOR_Y - 18,
    };

    assert.deepEqual(
      declutterLabels([women, ohneVersatz, romanshorn], 9).map((k) => k.name),
      ["Frauenfeld", "Romanshorn"],
    );
    assert.deepEqual(
      declutterLabels([women, mitVersatz, romanshorn], 9).map((k) => k.name),
      ["Frauenfeld", "Ottenberg", "Romanshorn"],
    );
  });
});
