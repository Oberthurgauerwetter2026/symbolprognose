## Ziel

Auf `/karten/radar` **nur** die isolierten Einzelpixel-Artefakte entfernen — Sprenkel in der Messung und Einzel-Kacheln in der Prognose. **Kein** Glätten (kein Boxcar, kein Gauss), **kein** Crossfade, keine Blend-Effekte. Kanten, Farbbänder, harte Frame-Wechsel bleiben exakt wie jetzt.

## Diagnose

Beide Artefakte im Screenshot sind isolierte Einzelzellen im Quell-Grid:
- **Messung**: 1-Pixel-Clutter im MCH-Radar (Bodenechos), Nachbarn ~0.
- **Prognose**: einzelne Grid-Zellen mit sprunghaft höherem Wert als alle Nachbarn (numerisches Modell-Rauschen bei ~3 km), erscheinen nach bilinearer Interpolation als rechteckige Kachel.

Beides lässt sich mit einem **Despeckle-Filter** entfernen, der die Werte *nicht* mittelt:

> Für jede Zelle: zähle Nachbarn (8er-Kernel) mit Wert ≥ min-Threshold (0.1 mm/h). Sind es ≤ 1, setze die Zelle auf 0. Sonst unverändert lassen.

Das killt echte 1- und 2-Pixel-Spikes, aber **berührt keinen Wert einer echten Niederschlagsfläche** (dort haben Zellen ≥ 3 Nachbarn > 0). Kein Averaging → keine Glättung, keine weichen Kanten.

## Änderungen (nur `src/components/maps/radar-map.tsx`)

### A) Prognose (`PrecipOverlay`)

Die bestehende `smooth3x3`-Funktion (in `redrawRef` und `buildOffscreenRef`, zwei identische Kopien) durch `despeckle` ersetzen — 8-Nachbarn-Zählung, isolierte Zellen → 0, alle anderen Werte **unverändert**. Auf `vals` und `snowVals` anwenden. Kommentar entsprechend anpassen (aktuell "3×3-Boxcar-Smoothing … glättet Grid-Kanten" ist dann falsch).

### B) Messung (`MeasurementCanvasOverlay.ensureSmooth`)

Umbenennen zu `ensureDespeckled` (samt einer Umbenennung des Feldes `smoothMmh` → `cleanMmh` im `DecodedRadar`-Typ) und dieselbe Despeckle-Logik einsetzen — kein Mean-Filter mehr. Cache-Semantik bleibt (einmal berechnet, in `DecodedRadar` gehalten). Aufrufstelle bei Zeile 1292 folgt der Umbenennung.

### C) Kein Crossfade / kein Blend

Im Code sind Crossfade/Optical-Flow-Blend bereits deaktiviert (Kommentar Zeile 731). Nichts hinzufügen. Frame-Wechsel bleiben hart.

## Nicht geändert

- Farbskalen (`SCALE`, `SNOW_SCALE`), harte Band-Quantisierung.
- Bilineare Interpolation im Canvas-Downsample (nicht Datenglättung — nur Pixel-Rasterung).
- Ingest (`scripts/ingest_*`), R2-Cache, `radar.functions.ts`.
- Timeline, Prewarm, LRU-Cache-Größen.
- Andere Karten (Wind, Niederschlag, Satellit).

## Verifikation

1. `/karten/radar`: Aktueller Frame — keine isolierten Sprenkel innerhalb der Region. Grosse Regenfläche unverändert in Form und Farbe.
2. Timeline auf Prognose-Frame — keine solitären orange/gelben Rechteckkacheln mehr, aber Bandkanten der Hauptfläche exakt so scharf wie vorher.
3. Play: harter Frame-Wechsel wie bisher, kein Fade.
4. Vergleich zu Screenshot: Sprenkel weg, Blöcke weg, alles andere identisch.
