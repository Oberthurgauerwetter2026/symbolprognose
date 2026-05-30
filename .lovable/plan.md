# Radar-Prognose: Abdeckung erweitern + Felder so markant wie Messung

Die letzte Runde hat den weichen, niedrig-deckenden Look erzeugt (Alpha 0.30→0.62, blur 2.5 px, STEP=2, Clip auf Messrahmen). Das Bild im Screenshot zeigt genau diesen Zustand. Jetzt umkehren in Richtung „so markant wie die MeteoSchweiz-Messung" und über den Messrahmen hinaus zeichnen.

Alle Änderungen ausschliesslich in `src/components/maps/radar-map.tsx`. Keine Server-, API-, DB- oder Manifest-Änderungen.

## 1. Abdeckung über Messrahmen hinaus

In `PrecipOverlay.redrawRef`:

- `ctx.save() / ctx.clip()` auf `payload.imageBbox` entfernen.
- Stattdessen über das volle Daten-Grid zeichnen (`gridLat[0..n-1]` × `gridLon[0..n-1]`, also die volle ICON-Bbox ~46.85–48.30 / 8.15–10.55).
- Bestehender BUFFER-/Threshold-Test bleibt; ausserhalb des Datenbereichs wird ohnehin nichts gezeichnet.

## 2. Prognose-Felder so markant wie Messung

In derselben Datei:

- **CSS-Filter** (`cv.style.filter`): `blur(2.5px) saturate(1.35) contrast(1.08)` → `blur(0.8px) saturate(1.6) contrast(1.25)`.
- **`colorFor()` Alpha-Ramp**: `alphaA = 0.30 / 0.62` und `alphaB = 0.62` → `alphaA = 0.55 / 0.92`, `alphaB = 0.92`. Tail-Alpha (≥ 60 mm/h) `0.65` → `0.95`.
- **`snowColorFor()` Alpha**: `0.60` → `0.85`.
- **`STEP`**: `2` → `1` (volle Container-Auflösung, schärfere Kanten). `imageSmoothingQuality = "high"` bleibt.
- Threshold-Cutoff (0.1 mm/h) bleibt.

## 3. Unverändert

- 48-h-Prognosehorizont (Punkt 1 der vorigen Runde) bleibt.
- Footer-Text „Vorhersage bis +48 h" bleibt.
- Snow-Scale, Legende, Timeline-UI, Manifest, R2, Ingest, Server-Fns bleiben.

## Technische Details

- Nur Frontend-Render-Pfad: zwei Konstanten-Blöcke (`colorFor`, `snowColorFor`), eine CSS-Filter-Zeile, ein `STEP`-Wert, ein `save/clip/restore`-Block entfernen.
- Performance: STEP=1 vervierfacht Pixel-Sample-Count; bei ~600×500 px ist das auf modernen Rechnern weiterhin <10 ms pro Frame.
