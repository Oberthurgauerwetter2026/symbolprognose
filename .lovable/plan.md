# Fix Workflow + Prognose-Optik

## 1. GitHub-Workflow Versionscheck (Hotfix)

`.github/workflows/radar-ingest.yml`:

- `EXPECTED_RADAR_INGEST_VERSION` von `v13-safe-cpc-rebuild` → `v14-mch-palette`.

Damit greift der Versions-Guard wieder und der Ingest läuft durch.

## 2. Prognose-Bubbles: schärfere Konturen wie im Referenzbild

Im Referenzbild sieht man harte, deutlich abgesetzte Iso-Bänder ohne Weichzeichnung. Aktuell:

- `cv.style.filter = "saturate(1.3) contrast(1.2)"` zieht subtile Halos.
- `ctx.imageSmoothingEnabled = false` ist gut, aber der Canvas-Filter wirkt trotzdem.
- Bandfarben-Alpha 0.9/0.95 ok. Farbenskala Messung und prognose muss identisch sein

Änderungen in `src/components/maps/radar-map.tsx` → `PrecipOverlay`:

- Canvas-Filter entfernen (`cv.style.filter = "none"`) — Farben kommen direkt aus `SCALE`, das matcht bereits MCH-CombiPrecip/Messung.
- `SCALE`-Alpha auf konstant `0.92` (alle Bänder gleich opak → klare Kanten, kein „Glow" am Top-Band).

Optional zur Kantenschärfe: leichtes Snap der Interpolation in der Nähe von Bandgrenzen — **nicht** umgesetzt, da Bilinear + quantisierte Farbe bereits die gewünschten Iso-Bänder produziert, sobald der Filter weg ist.

## 3. Flüssigere Animation

In `src/components/maps/radar-map.tsx` Playback-Loop (~Zeile 817/834):

- Default-Speed bleibt 1×, aber `FRAME_MS` von `800/speed` auf `600/speed` reduzieren → kürzere Frame-Distanz, mehr Lerp-Schritte pro Sekunde wirken flüssiger. Die bilineare Werte-Interpolation per `progress` ist bereits aktiv und reicht für weichen Übergang zwischen 15-min-Frames.

## Nicht geändert

- `colorFor`-Bänder (matchen bereits Messungs-Palette).
- `scripts/ingest_radar.py` (Palette bereits MCH-konform aus letztem Turn).
- Frontend-Filterlogik, Bias-Korrektur, Schnee-Layer, Hagel-Layer.

## Dateien

- `.github/workflows/radar-ingest.yml`
- `src/components/maps/radar-map.tsx`