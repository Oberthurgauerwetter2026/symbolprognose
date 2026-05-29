# Plan: Ensemble-basierte Radar-Prognose

## Ziel

Die Radar-Animation auf `/karten/radar` soll nicht mehr aus einzelnen deterministischen Läufen (heute: ICON-CH1 + ICON-CH2 + 1 Bewegungsvektor) entstehen, sondern aus einem **Ensemble**:

- **Forecast**: ICON-CH1-EPS (21 Member, +33 h, 1 h) und ICON-CH2-EPS (21 Member, +120 h, 1 h) — selbst ingestiert als GRIB2 vom MeteoSchweiz-OGD-STAC.
- **Nowcast** (T+0 … +90 min): k=8 Bewegungsvektoren pro Frame statt einem, plus Sampling von Wachstum/Zerfall → 8 Member-Extrapolationen.
- **Vergangenheit**: bleibt deterministisch (echte MCH-CPC-Messung, unverändert).

Visuell soll es **weiter wie ein einzelnes Radarbild aussehen, das über die Karte zieht** — der Ensemble-Charakter steckt im Bild selbst:

- Pro Zeitschritt wird der **Ensemble-Mittelwert** der mm/h-Felder gerendert (gleiche Farbskala wie heutige CPC-PNGs).
- Mit zunehmender Vorhersagezeit wirkt das Bild durch die Member-Streuung weicher / verwaschener (= sichtbare Unsicherheit, ohne separates Probability-Layer).
- Optional unauffälliger Spread-Indikator (z. B. dünne Kontur P80) — kann später dazu, ist nicht Teil dieses Plans.

## Konsequenzen vorweg

- **Daten-Pipeline wird wesentlich grösser**: pro 6-h-EPS-Lauf grob 21 Member × ~120 h × Variable als GRIB2 vom MCH-STAC. Workflow-Laufzeit pro Lauf ~5–15 min, R2-Bedarf grob 0.5–2 GB pro Lauf (nach Crop + Resampling auf das BBox-Grid, vor Komprimierung deutlich weniger).
- **EPS-Läufe sind 6-stündlich**, nicht 5-minütlich → der Forecast-Teil aktualisiert nur 4×/Tag. Nowcast bleibt 5-minütlich (Radar-Cadence).
- **Latenz MCH-OGD**: ICON-CH1/CH2-EPS sind typ. 2–3 h nach Lauftermin auf STAC verfügbar. Plan deckt das ab (Lookback auf jüngsten kompletten Lauf).
- Die heutige Open-Meteo-Schiene (ICON-CH1 minutely_15) wird im Radar **nicht mehr verwendet**, bleibt aber für andere Widgets (Lokalprognose etc.) bestehen.

---

## Schritte

### 1. EPS-Ingest (neuer Python-Workflow)

Neue Datei `scripts/ingest_icon_eps.py`, getriggert von neuem Workflow `.github/workflows/icon-eps-ingest.yml`.

- Cron alle 30 min (idempotent, lädt nur, wenn neuer kompletter Lauf da ist).
- Quelle: MeteoSchweiz-OGD-STAC, Collections `ch.meteoschweiz.ogd-forecasting-icon-ch1-eps` und `…-icon-ch2-eps`.
- Variablen (Minimum für „Radarbild"): `TOT_PREC` (akkumuliert, daraus stündliche Differenz = mm/h), `SNOW_GSP` + `SNOW_CON` (für Schnee/Regen-Trennung wie heute).
- Pro Lauf:
  - 21 Member herunterladen (parallel mit Backoff).
  - GRIB2 → numpy via `cfgrib`/`xarray` (oder `pygrib`).
  - Auf BBox-Grid resamplen (gleiches Grid wie heutige CPC-PNGs, EPSG:3857, 1024×768).
  - Pro Forecast-Zeitschritt **Ensemble-Mean (mm/h)** und **P(>0.1 mm/h)** berechnen — beides separat speichern, auch wenn nur Mean gerendert wird (Spread für spätere Visualisierungen reserviert).
  - Mean-Feld mit gleicher Farbskala wie CPC rendern → PNG.
  - Upload nach R2 unter `radar/eps/<modelKey>/<runIso>/<stepIso>.png` und Metadaten `radar/eps/<modelKey>/<runIso>/meta.json` (enthält pro Step: mean-PNG, prob-Array komprimiert als Float16 oder als 8-bit-PNG-Probability-Layer, max mm/h, …).
- Manifest `radar/eps/latest.json`:
  ```json
  { "ch1": { "run": "...", "steps": [...] }, "ch2": { "run": "...", "steps": [...] } }
  ```
- Retention: 2 Läufe pro Modell behalten (Rest löschen).

### 2. Nowcast-Ensemble (Server-Seite, im Worker)

In `src/lib/radar.functions.ts`:

- Phase-Correlation derzeit liefert **einen** Vektor. Ersetzen durch **k=8 Vektoren**:
  - 4 Vektoren aus Phase-Correlation auf 4 Subregionen (Quadranten der Region-BBox).
  - 4 Vektoren = obige ± kleine Störungen (Sampling aus Vektor-Kovarianz der letzten 6 Frames).
- Wachstum/Zerfall pro Member: `growth_per_min` ± 1σ aus Trend-Verteilung.
- Pro Nowcast-Zeitschritt (alle 10 min, +10 … +90 min):
  - 8 verschobene Versionen des letzten CPC-PNG (jeweils `imageOffset` + `opacity`).
  - Im Frontend (Leaflet) als **8 ImageOverlays mit Opacity = blendOpacity/8** stapeln → visuelle Mittelung im Browser, ohne Server-Rendering. Ergebnis sieht aus wie ein verwaschenes wanderndes Radarbild; je grösser die Streuung der Vektoren, desto weicher.
- Soft-Blend Nowcast → ICON-CH1-EPS bleibt wie heute (60…90 min Crossfade).

### 3. Read-API umstellen

`getRadarFrames` (server function) liefert die `RadarFrame[]`-Sequenz:

- **Vergangenheit**: unverändert (CPC-PNGs aus `radar/frames.json`).
- **Nowcast (now…+90 min)**: pro Zeitschritt jetzt `frames[].members: { precipUrl, imageOffset, opacity }[]` statt eines einzigen `precipUrl` + `imageOffset`. Backwards-kompatibles Feld: wenn `members.length === 1`, identisch zu heute.
- **Forecast (+~60 min … +120 h)**: pro Step ein einziges `precipUrl` (das Mean-PNG aus EPS), Quelle `"icon-ch1-eps"` bzw. `"icon-ch2-eps"`. Crossfade CH1-EPS → CH2-EPS bei +33 h.
- Bias-Korrektur (Radar vs. ICON in den ersten 30 min) bleibt sinngemäss erhalten, jetzt gegen den EPS-Mean.

### 4. Frontend (`src/components/maps/radar-map.tsx`)

- Frame-Renderer erweitern: wenn `frame.members` gesetzt → mehrere `<ImageOverlay>` mit gestaffelter Opacity rendern, sonst wie bisher.
- Legenden-/Tooltip-Text anpassen: „ICON-CH1-EPS (21 Member, Mean)" statt „ICON-CH1". Keine sonstigen UI-Änderungen (Slider, Play-Button, Layout bleiben).
- Quellenhinweis in der Karte aktualisieren.

### 5. Cleanup

- Alte Pfade in `radar.functions.ts` für deterministisches ICON-CH1/CH2 entfernen (`minutely_15.precipitation`-Branch, soweit nicht mehr referenziert).
- Open-Meteo-Cache für Radar nicht mehr lesen (andere Widgets bleiben).
- `.lovable/plan.md` aktualisieren.

---

## Risiken / offene Punkte

- **GRIB2-Bibliotheken in GitHub-Actions**: `cfgrib` braucht `eccodes` (apt-Paket). Im Workflow vor `pip install` `apt-get install -y libeccodes0 libeccodes-dev`.
- **R2-Volumen**: Wenn 2 Läufe × 2 Modelle × ~120 Steps × 2 Layer (mean+prob) je ~30 KB komprimiertes PNG ≈ 60–150 MB R2-Speicher dauerhaft. Vertretbar.
- **MCH-OGD-Rate-Limits**: parallel 21 Member ziehen → Backoff/Concurrency-Limit (z. B. 4 parallel) im Skript.
- **EPS-Verfügbarkeitslücke**: bis erster EPS-Lauf gecached ist, soll der Forecast-Teil graceful auf „—" gehen statt zu crashen. Erste Iteration darf ICON-CH1-deterministisch als Fallback behalten (Feature-Flag `EPS_ONLY=false` default), bis die EPS-Pipeline stabil läuft. Empfehlung: Flag in einer zweiten Iteration auf `true` schalten.

---

## Technischer Anhang

Neu / geändert:

```text
scripts/
  ingest_icon_eps.py                    NEU — GRIB2-Ingest CH1-EPS + CH2-EPS
  requirements.txt                      + cfgrib, xarray, eccodes-python

.github/workflows/
  icon-eps-ingest.yml                   NEU — Cron alle 30 min

src/lib/
  radar.functions.ts                    Nowcast: 1 → 8 Vektoren; Forecast: EPS-Manifest
  icon-eps-cache.server.ts              NEU — R2-Reader für radar/eps/latest.json

src/components/maps/
  radar-map.tsx                         Multi-ImageOverlay-Rendering, Legenden-Text
```

Datenfluss:

```text
                       MCH-OGD STAC (GRIB2, 6h-Cadence)
                                 │
              GitHub Action (ingest_icon_eps.py, alle 30 min)
                                 │
                       resample + mean + prob
                                 │
                Cloudflare R2 (radar/eps/<model>/<run>/*.png + meta)
                                 │
                       Worker (getRadarFrames)
                                 │
                Leaflet (1 PNG Forecast, 8 PNGs Nowcast)
```
