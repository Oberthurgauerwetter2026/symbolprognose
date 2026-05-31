# Leichten Niederschlag sichtbar wie bei MCH/SRF

## Ursache (kurz)

Unterstes Band `0.1–0.3 mm/h` ist mit Alpha 90/255 fast unsichtbar. Multipliziert mit Overlay-Opacity `0.85` bleibt effektive Deckkraft ~30 %. Resultat: leichter Regen verschwindet, obwohl Daten identisch zu MCH/SRF sind. Gilt für Messung (PNG) und Prognose (Canvas), weil beide dieselbe Skala nutzen.

## Änderungen

### 1. `scripts/ingest_radar.py` — Messung (PNG)

`PRECIP_SCALE` unterstes Band kräftiger:
```
0.1–0.3   (170, 205, 240, 220)   # statt (200,220,245, 90)
```
Alle anderen Bänder unverändert (RGB + alpha=255). Version-Tag auf `v18-mch-faint-fix` → triggert Purge der alten v17-PNGs beim nächsten Run.

### 2. `.github/workflows/radar-ingest.yml`

`EXPECTED_RADAR_INGEST_VERSION: "v18-mch-faint-fix"`.

### 3. `src/components/maps/radar-map.tsx` — Prognose (Canvas)

`SCALE` 1:1 synchron:
```ts
{ mmh: 0.1, rgb: [170, 205, 240], a: 220/255 }
```
Da `colorFor()` von Messung und Forecast geteilt wird, ist damit auch der Canvas-Forecast bei leichtem Regen so kräftig wie bei MCH/SRF — kein zusätzlicher Codepfad nötig.

Overlay-Opacity bleibt `0.85` (Reliefkontrast erhalten).

### Verifikation

- Nächsten Ingest-Lauf (5 Min via Cron) abwarten.
- Frame mit leichtem Regen gegen `meteoschweiz.admin.ch` und `srf.ch/meteo/radar` vergleichen → das hellblaue Band muss klar zu sehen sein.

### Nicht im Umfang

- Schwellen (0.1 / 0.3 / 1 / 3 / 10 / 30 / 60 / 100), Schnee, Hagel, Timeline, Cross-Fade — alle unverändert.

**Dateien:** `scripts/ingest_radar.py`, `.github/workflows/radar-ingest.yml`, `src/components/maps/radar-map.tsx`.
