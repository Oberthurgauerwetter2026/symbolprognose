# Nowcast-Verlagerung: Null-Motion verwerfen + Wind-Fallback

## Problem

Manifest enthält aktuell `motion = { u_ms: 0, v_ms: 0, confidence: 1.0 }`.
Die FFT-Phasenkorrelation rastet bei flachen / persistenten Szenen am Null-Peak ein und meldet trotzdem hohe Confidence. Der Server erzeugt 6 Nowcast-Frames mit `imageOffset = (0, 0)` — Niederschlag steht still.

## Änderungen

### 1. `scripts/ingest_radar.py` — degenerierte Motion verwerfen

In `compute_motion`:
- Pair-Filter: Einzelpaare mit `|dx_px| < 0.5 ∧ |dy_px| < 0.5` werden nicht in `pair_motions` aufgenommen.
- Nach Median-Bildung: wenn `|u_px_min| < 0.5 ∧ |v_px_min| < 0.5` oder keine validen Pairs → `return None`.
- Log: `motion: zero shift → discarded`.

### 2. `src/lib/radar.functions.ts` — Wind-Fallback

Wenn `motion` fehlt oder degeneriert ist (`|u_ms| + |v_ms| < 1.0`) und das letzte Radar-Frame existiert:

- Aus dem bereits in `r1` (Open-Meteo hourly) vorhandenen Punkt, der dem Bbox-Mittelpunkt am nächsten liegt, `wind_speed_10m` + `wind_direction_10m` für die Stunde von `lastRadarT` lesen.
- Falls `wind_direction_10m` nicht in `r1` enthalten ist (Variablenliste prüfen), Variable zum Open-Meteo-Request hinzufügen.
- Steering-Annäherung: `speed_steer = wind_speed_10m * 1.8` (grober Faktor 10 m → ~700 hPa für offenes Gelände).
- Vektor (meteo-Konvention „Wind aus …"):
  `u_ms = -speed_steer * sin(dir_rad)`, `v_ms = -speed_steer * cos(dir_rad)`.
- Umrechnung in `u_deg_per_min`, `v_deg_per_min` mit `m_per_deg_lon = 111_000 * cos(midLat)`, `m_per_deg_lat = 111_000`.
- Neuer `kind`-Marker: Nowcast-Frames bekommen `source: "nowcast"` + zusätzliches Flag `motionSource: "wind"` (im `RadarFrame`-Typ ergänzen).

### 3. `src/components/maps/radar-map.tsx` — Label

`sourceLabel` / `fmtBubble`:
- Bei `frame.source === "nowcast"` und `frame.motionSource === "wind"` Label „Nowcast (Wind-Fallback)" anzeigen, sonst weiter „Nowcast Radar-Extrapolation".

## Nicht im Scope

- Kein Pixel-optisches-Flow.
- Keine Änderung an Farbpaletten, Hagel, Schnee, Geometrie.
- Keine Erweiterung auf 700 hPa-Pressure-Level-Wind (nur falls hourly-Variable bereits trivial verfügbar; sonst 10 m × 1.8).

## Verifikation

- Ruhige Lage, leere Szene → `motion = null`, keine Nowcast-Frames, ICON-CH1 ab T+0.
- Reale Zellverlagerung → Phase-Korrelation liefert Drift, Nowcast verschiebt sich sichtbar.
- Niederschlag + Null-Radar-Motion → Wind-Fallback bewegt das Bild, Label „Wind-Fallback".
