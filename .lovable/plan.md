# Radar-Verbesserungen

## 1. Prognosezeitraum auf 48 h reduzieren

**Datei:** `src/lib/radar.functions.ts`

- `forecastCutoff = now + 48 * 3600 * 1000` (statt `120 * 3600 * 1000`).
- ICON-CH1 (minutely_15) bleibt bis +33 h, ICON-CH2 (hourly) füllt nur noch +33…+48 h auf — die Begrenzung greift automatisch über `forecastCutoff`.
- Quellen-Footer in `src/components/maps/radar-map.tsx` von „Vorhersage bis +32 h / +120 h" auf „Vorhersage bis +48 h" anpassen.

## 2. Prognose-Abdeckung wie Messung

Aktuell rendert die Messung als PNG mit `imageBbox` (echter MeteoSchweiz-Radar-Ausschnitt, ca. Oberthurgau-Quadrat). Die Prognose rendert dagegen auf dem ganzen Daten-Grid (BBOX 47.30–47.85 / 8.85–9.85) und ragt deutlich über den Radar-Kasten hinaus — sichtbar im Screenshot als grosse grüne Fläche weit ausserhalb des blauen Rahmens.

**Lösung in `PrecipOverlay`** (`src/components/maps/radar-map.tsx`):

- Vor dem Zeichnen den Canvas auf `payload.imageBbox` clippen (Polygon-Pfad in Container-Pixeln, `ctx.clip()`), nicht auf das volle Daten-Grid.
- Damit füllt das Prognose-Canvas genau denselben Rahmen wie die Radar-PNGs.

## 3. Niederschlagsfelder „schöner" rendern

Aktuelles Bild ist blockig/körnig (1-px-Sampling + `blur(1px) saturate(2.0) contrast(1.5)`). Ziel: weiche, organische Blobs wie auf echten Radarbildern.

**In `PrecipOverlay.redrawRef`:**

1. **Sanftere Farbabstufung:** in `colorFor` zwischen den 9 SCALE-Stops linear interpolieren (RGB + Alpha), statt nur den nächstniedrigeren Stop zu nehmen. Gibt fliessende Übergänge statt harter Stufen.
2. **Niedrigere Pixel-Auflösung mit Upsampling:** Sampling auf STEP=2 (statt 1), Canvas in halber Auflösung füllen und dann mit `ctx.imageSmoothingEnabled = true` + `imageSmoothingQuality = "high"` hochskalieren. Erzeugt natürliche Weichzeichnung ohne Performance-Verlust.
3. **CSS-Filter glätten:** `blur(2px) saturate(1.4) contrast(1.1)` (statt `blur(1px) saturate(2.0) contrast(1.5)`) — weniger künstlich, näher an MeteoSchweiz-Optik.
4. **Niedriger Threshold-Cutoff** auf 0.1 mm/h (statt 0.05) für sauberere Ränder ohne Rauschen.

## Technische Details

- Keine API-Änderungen, kein neuer Server-Endpoint, kein neuer Ingest.
- Keine DB-Migrationen.
- Nur Frontend-Render-Pfad + ein Konstanten-Change im Server-Fn.

## Nicht Teil dieser Änderung

- Radar-Manifest / R2 / Ingest-Skripte bleiben unangetastet.
- Snow-Overlay-Logik bleibt gleich.
- Timeline-UI bleibt strukturell gleich (nur Endzeitpunkt rückt nach +48 h).
