
# Messung: gleiche Farbgebung ausserhalb der Schweiz wie Prognose

## Status quo

- Forecast-Frames (`icon-ch1`, `icon-ch2`) werden vom Canvas-Layer (`PrecipOverlay`) über die ganze erweiterte BBOX (Bodensee + Süddeutschland + Vorarlberg) mit der MeteoSchweiz-Farbskala (`colorFor`) gerendert.
- Messung-Frames (`source: "radar"`) liefern nur die MeteoSchweiz-CombiPrecip-PNG als `ImageOverlay`. Diese PNG ist ausserhalb der Schweiz transparent → grau, keine Farbe.
- Beide Datenquellen sind technisch vorhanden: Der Open-Meteo-Ingest holt bereits `past_minutely_15: 48` (= 12 h Vergangenheit), nur werden die Werte für `tMs <= now` aktuell verworfen (`radar.functions.ts` Zeile 479: `if (tMs <= now && hasRealRadar) continue;`).

## Änderungen

### 1. `src/lib/radar.functions.ts` — Werte auch für Messung-Frames belegen

Beim Aufbau der Radar-Frames (Block ab Zeile ~245, `for (const mf of filled)`):
- Aus `r1` (Open-Meteo-Antwort) für jeden Gridpunkt den `past_minutely_15.precipitation`-Wert zum Frame-Timestamp `mf.t` sampeln (Lookup über `time`-Array).
- Falls vorhanden, `values` (und `snowValues` analog) wie bei den ICON-CH1-Frames befüllen (mm/15min × 4 → mm/h).
- `precipUrl` und `hailUrl` bleiben unverändert → MCH-PNG wird weiterhin angezeigt.
- Zusatzfeld `blendOpacity` für Messung-Frames bei 1 belassen.
- Zeile 479 bleibt unverändert: ICON-CH1-Frames in der Vergangenheit weiterhin überspringen, weil wir die Werte schon in den Messung-Frames eingebaut haben.

Falls für einen Messung-Timestamp kein passender Open-Meteo-Slot existiert (Toleranz ±10 min für nearest-Match), bleibt `values: []` — Verhalten wie heute.

### 2. `src/components/maps/radar-map.tsx` — Canvas + PNG übereinander für Messung

Render-Block (Zeile ~871–903) so umbauen, dass bei einem Messung-Frame mit `precipUrl` UND nichtleerem `values`-Array BEIDE Layer gerendert werden:

```text
- PrecipOverlay (Canvas, deckt die ganze BBOX ab — z-index niedriger)
- ImageOverlay (MCH-PNG, transparent ausserhalb CH — z-index höher)
```

Konkret:
- Canvas-Layer (`PrecipOverlay`) bekommt `zIndex: 440` (statt 450).
- MCH-`ImageOverlay` bekommt explizit `zIndex={460}` Prop (Leaflet `ImageOverlay` unterstützt das).

Effekt:
- Innerhalb der Schweiz: MCH-PNG dominiert (volle Auflösung, scharfe Radar-Echos).
- Ausserhalb (Bodensee D-Seite, Süddeutschland, Vorarlberg): Open-Meteo-Grid mit identischer `colorFor`-Skala leuchtet durch.

Forecast-Frames (`precipUrl` undefined) verhalten sich exakt wie heute — nur Canvas, kein PNG.

### 3. Filter/Blur auf dem Canvas

Der bestehende `cv.style.filter = "blur(0.8px) saturate(1.6) contrast(1.25)"` bleibt für Forecast-Frames erhalten. Für Messung-Frames wirkt er nur ausserhalb CH (innerhalb wird er von der PNG überdeckt) — kein optischer Bruch erwartet, aber kurz im Preview verifizieren. Falls auffällig, alternative: Filter beibehalten (keine Sonderlogik nötig).

## Nicht Teil dieser Änderung

- Keine Änderung an Ingest-Skripten, Grid-Geometrie, Radar-Bounds, Nowcast-Logik, ICON-CH2, Snow-Skala oder Bias-Korrektur.
- Keine DB-, Auth-, Server-Fn-Signatur-Änderungen.
- Hail-Overlay, Legende, Timeline, Steuerung bleiben unverändert.

## Lifecycle

- Sofort wirksam nach Deploy: Der R2-Cache enthält bereits `past_minutely_15`-Daten; es muss kein neuer Cron-Lauf abgewartet werden.
- Falls `past_minutely_15` im Cache leer ist (sehr alter Snapshot), bleiben Messung-Frames bei leeren `values` → degradiert sauber auf den aktuellen Zustand (graue Fläche ausserhalb CH).
