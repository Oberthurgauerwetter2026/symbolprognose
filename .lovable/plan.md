## Drei Aufräum-Arbeiten in einem Schritt

Aktueller Stand vs. Soll:

1. **Messung „alte Frames":** Python-Ingest rendert MCH-PNGs noch mit der **alten** Palette (9 Stufen: 0.2/1/2/4/6/10/20/40/60 mm/h), das TS-Frontend wurde aber auf MCH-CombiPrecip umgestellt (0.1/0.3/1/3/10/30/60/100). Beide Seiten zeigen unterschiedliche Farben für dieselbe Intensität — der gleiche Zeitstempel sieht plötzlich anders aus, weil Messung-PNG und Prognose-Canvas verschiedene Skalen sprechen. Zusätzlich liegen in R2 noch PNGs aus alten Ingest-Versionen herum.
2. **Prognose-Bubble-Form:** `PrecipOverlay` benutzt einen **Sigmoid-Sharpening-Faktor SHARP=7** auf der bilinearen Interpolation → erzeugt unnatürlich kantige, „geometrische" Bubbles statt der weichen, gerundeten Iso-Konturen, wie sie Wetterdienste (MCH, DWD, ECMWF-Forecast-Maps) zeigen.
3. **Toter Nowcast-Code** im Python-Ingest und in der TS-Pipeline:
  - `scripts/ingest_radar.py`: `compute_motion`, `_phase_correlation`, `_phase_correlation_tiles`, `_load_wind_prior`, `_aggregate_motion_field`, `TILE_*`-Konstanten und das `motion`-Feld im Manifest — alles unbenutzt.
  - `src/lib/radar.functions.ts`: das `motion?: unknown` im `Manifest`-Type.

## Änderungen

### 1. `scripts/ingest_radar.py` — Palette synchronisieren + Nowcast-Code raus

- `**PRECIP_SCALE` auf MCH-CombiPrecip-Palette** (identisch zu TS `SCALE`):
  ```python
  PRECIP_SCALE = [
      (0.1, (165, 215, 245, 230)),
      (0.3, (90, 165, 230, 230)),
      (1.0, (30, 80, 200, 230)),
      (3.0, (40, 170, 70, 230)),
      (10.0, (245, 220, 40, 230)),
      (30.0, (240, 140, 30, 230)),
      (60.0, (220, 30, 30, 230)),
      (100.0, (160, 30, 180, 242)),
  ]
  ```
  Alpha einheitlich 230 (≈0.9), Top-Band 242 (≈0.95) — passt zur `colorFor`-Logik im Frontend.
- `**RADAR_INGEST_VERSION**` auf `"v14-mch-palette"` heben → bestehender Versions-Migration-Code in `main()` purged automatisch alle alten radar/*.png-Objekte im R2. Nach dem nächsten Run liegen nur noch frische PNGs mit der neuen Palette im Bucket. Damit verschwinden die „alten Frames".
- **Komplett entfernen** (dead code):
  - Funktionen: `_phase_correlation`, `_phase_correlation_tiles`, `_load_wind_prior`, `compute_motion`, `_aggregate_motion_field`.
  - Konstanten: `TILE_PX`, `TILE_STRIDE`, `TILE_MIN_WET`, `TILE_MIN_CONF`, `TILE_MAX_SHIFT_PX`.
  - In `main()`: der `try/except` um `compute_motion(...)` und die `motion`-Variable.
  - `write_manifest()`: Parameter `motion` weg, `body["motion"]`-Zweig weg.
  - Kommentar-Blöcke über den entfernten Funktionen.

### 2. `src/lib/radar.functions.ts` — Type aufräumen

- `Manifest`-Type: `motion?: unknown` entfernen (Manifest hat das Feld ab v14 nicht mehr).

### 3. `src/components/maps/radar-map.tsx` — Bubble-Form natürlicher. siehe: [https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/niederschlag.html](https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/niederschlag.html)

In `PrecipOverlay.redrawRef.current`:

- **Sigmoid-Sharpening entfernen**: die 4 Zeilen
  ```ts
  const SHARP = 7;
  const sharpen = (u) => 1 / (1 + Math.exp(-SHARP * (u - 0.5)));
  const tx = sharpen(txRaw);
  const ty = sharpen(tyRaw);
  ```
  ersetzen durch reine bilineare Gewichte:
  ```ts
  const tx = txRaw;
  const ty = tyRaw;
  ```
  → glatte Bilinear-Interpolation. In Kombination mit der quantisierten `colorFor` ergeben sich genau die runden, weichkantigen Iso-Konturbänder, wie sie übliche Wetterdienst-Vorhersagekarten zeigen.
- Canvas-Filter `filter: "saturate(1.3) contrast(1.2)"` bleibt, hebt die quantisierten Farbbänder ohne Streifenartefakte hervor.

## Nicht angefasst

- `SCALE` / `colorFor` im Frontend (bereits MCH-konform).
- Bias-Korrektur, Forecast-Cutoff, R2-Manifest-Format-Felder ausser `motion`.
- Hagel-Layer (POH-PNGs, `HAIL_SCALE`).
- Workflow `.github/workflows/radar-ingest.yml`, Cron-Worker.

## Verifikation

- Nach dem nächsten Ingest-Run:
  - R2 enthält nur noch v14-PNGs (alte sind durch Versions-Migration weg).
  - `radar/frames.json` hat kein `motion`-Feld mehr.
- `/karten/radar`:
  - Messung-PNG und Prognose-Canvas zeigen für gleiche mm/h die **gleichen Farben** beim Übergang Messung→Prognose.
  - Prognose-Bubbles haben runde, weiche Iso-Konturbänder (keine eckigen/„geometrischen" Ränder mehr).
- `scripts/ingest_radar.py` ist deutlich kürzer (~700 Zeilen statt 1279).

## Dateien

- `scripts/ingest_radar.py`
- `src/lib/radar.functions.ts`
- `src/components/maps/radar-map.tsx`