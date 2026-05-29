# Plan: Ensemble-basierte Radar-Prognose

Status der Umsetzung — gestaffelt in zwei Iterationen, damit Daten in R2 liegen, bevor das Frontend darauf zugreift.

---

## Phase 1 — Ingest-Pipeline (FERTIG, in dieser Iteration ausgeliefert)

Vollständig implementiert, aber **noch nicht im Frontend aktiv**. Der bestehende deterministische ICON-CH1-Pfad läuft unverändert weiter.

- `scripts/requirements.txt` — `pygrib==2.1.6` ergänzt.
- `scripts/ingest_icon_eps.py` — neuer GRIB2-Ingest:
  - Quelle: STAC-Collections `ch.meteoschweiz.ogd-forecasting-icon-ch1` / `-ch2` (intern bereits ICON-CH1-EPS / CH2-EPS — `ctrl` + `perturbed` Items, 21 Member total).
  - Variable: `tot_prec` (akkumuliert) → de-akkumuliert zu mm/h pro Intervall.
  - Resampling auf BBox-Grid 1024×768 in WGS84 (gleiche Bbox wie CPC-PNGs).
  - Pro Step: **Ensemble-Mean (mm/h) als farbiges PNG** (identische `PRECIP_SCALE` wie CPC, damit Mess- und Forecast-Bilder visuell deckungsgleich sind) + **P(>0.1 mm/h) als 8-bit Greyscale-PNG** (für spätere Unsicherheitsdarstellung).
  - Upload nach `radar/eps/<model>/<runTag>/{step}_mean.png` + `_prob.png`, Per-Run `meta.json`, globales `radar/eps/latest.json`.
  - Retention: aktueller + vorheriger Lauf pro Modell.
- `.github/workflows/icon-eps-ingest.yml` — Cron alle 30 min (idempotent: skippt, wenn aktueller Lauf schon publiziert ist), installiert `libeccodes` als Systemabhängigkeit.
- `src/lib/icon-eps-cache.server.ts` — typisierter R2-Reader (`getIconEpsManifest()`), 60 s in-Memory-Cache, robust gegen leeres/fehlendes Manifest. Wird in Phase 2 von `radar.functions.ts` konsumiert.

**Was als Nächstes passieren muss, bevor Phase 2 beginnen kann:**

1. GitHub-Secrets `R2_*` sind bereits gesetzt (Radar-Ingest nutzt sie). Workflow `ICON-EPS Ingest` manuell triggern.
2. R2 prüfen: `radar/eps/latest.json` muss existieren und für `ch1` ≥30 Steps, für `ch2` ≥60 Steps enthalten.
3. Ein Mean-PNG aus dem Browser/curl öffnen und sicherstellen, dass es plausibel aussieht (Bbox stimmt, Farben matchen CPC).

---

## Phase 2 — Frontend-Umstellung (OFFEN, nächste Iteration)

Wird ausgeführt, sobald Phase 1 stabil Daten liefert.

### 2a. Read-API umstellen

`src/lib/radar.functions.ts`:

- Forecast-Teil (alles `> now + ~60 min`):
  - Statt `phase1.minutely_15.precipitation` → `getIconEpsManifest()` lesen.
  - Pro Step ein `RadarFrame` mit Quelle `"icon-ch1-eps"` bzw. `"icon-ch2-eps"`, `precipUrl = meanUrl` (kein Canvas-Grid mehr — das EPS-Mean-PNG ist bereits ein "richtiges Radarbild").
  - Crossfade CH1-EPS → CH2-EPS am +33 h-Übergang.
- Bias-Korrektur (heute Radar vs ICON in den ersten 30 min) sinngemäss übernehmen: Vergleich gegen EPS-Mean statt minutely_15.
- Fallback-Flag: wenn `latest.json` fehlt oder leer → heutiger deterministischer Pfad als Fallback.

### 2b. Multi-Vektor-Nowcast (k=8)

`src/lib/radar.functions.ts`, Nowcast-Block:

- Heute: 1 Bewegungsvektor → ein verschobenes PNG pro Zeitschritt.
- Neu: k=8 Member-Vektoren:
  - 4× Phase-Correlation auf 4 Subregionen (Quadranten der Region-BBox) — Vorbedingung: Ingest-Skript schreibt diese in `motion`.
  - 4× perturbierte Versionen (Sampling aus Vektor-Kovarianz + `growth_per_min ± 1σ`).
- Pro Nowcast-Step liefert die Server-FN `members: { precipUrl, imageOffset, opacity }[]` statt eines einzigen `precipUrl`+`imageOffset`. Backwards-kompatibel: wenn `members.length === 1`, identisch zum heutigen Verhalten.

### 2c. Frontend Multi-Overlay

`src/components/maps/radar-map.tsx`:

- Wenn `frame.members` gesetzt → mehrere `<ImageOverlay>` mit Opacity = `blendOpacity / members.length` stapeln. Visuelles Mitteln im Browser, kein Server-Rendering.
- Für EPS-Forecast-Frames (`source` ∈ `"icon-ch1-eps"`, `"icon-ch2-eps"`): `<ImageOverlay>` statt Canvas-`PrecipOverlay`. Das macht den Forecast-Layer auch deutlich schneller (kein per-Pixel-Sampling im Browser).
- Legenden-/Tooltip-Text: „ICON-CH1-EPS (21 Member, Mean)" statt „ICON-CH1".

### 2d. Cleanup

- `phase1.minutely_15.precipitation`-Branch in `radar.functions.ts` entfernen, sobald EPS produktiv ist.
- Open-Meteo-Ingest weiter laufen lassen (andere Widgets brauchen ihn).

---

## Risiken / offene Punkte

- **EPS-Latenz**: MCH publiziert die Member über ~30–90 min nach Lauftermin verteilt. Der Ingest schaut, dass mind. h=1..3 vorhanden sind, bevor er einen Lauf akzeptiert — der frische Lauf wird also evtl. erst 60–90 min nach Lauftermin sichtbar. In der Übergangszeit liefert das Manifest weiterhin den vorherigen Lauf.
- **R2-Volumen**: pro Modell ≤2 Läufe × Mean+Prob × ~120 Steps × ~30 KB ≈ 30–60 MB pro Modell. Unproblematisch.
- **GRIB-Lib-Build**: `pygrib` braucht `libeccodes-dev` als apt-Paket — im Workflow vor `pip install`. Falls Build-Probleme: Alternative `cfgrib`/`xarray` (selbe System-Dep).
- **Resample-Index ist nearest-neighbour**: für die EPS-Auflösung CH1≈1 km, CH2≈2 km auf einer 1024×768-Output-Grid mit ~250 m Pixelgrösse ist das visuell sauber; für eine spätere Verfeinerung käme bilineare Interpolation in Frage.
