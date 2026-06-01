## Befund

Aus dem GH-Actions-Log:

- `asset ts range … newest=2026-06-01T06:35:00+00:00` → MCH STAC publiziert bis 06:35Z. Die 06:25/30/35-PNGs waren beim Anschauen noch nicht hochgeladen, weil der Run gerade erst durch 71 Frames durchfetcht (Log mittendrin abgeschnitten). Erklärt die scheinbar konstanten 15–20 min Lag.
- Dateinamen: `cpc2615200459_00060.001.h5` — das **`_00060`-Suffix ist die Akkumulationsdauer in Minuten**. Wir ziehen also CombiPrecip-CPC als **gleitenden 60-min-Mittelwert** in mm/h. Genau dieses Produkt sieht visuell „in die Länge gezogen" aus, weil jede Zelle in jedem Frame über ihre 60-min-Bahn gemittelt erscheint — sie wandert nicht, sie verlängert sich.

Der v20-ODIM-Time-Fix war also korrekt für die Zeit-Achse, behebt aber das Smearing nicht — es liegt am gewählten Produkt selbst.

## Lösung

MeteoSchweiz veröffentlicht in derselben Collection (`ch.meteoschweiz.ogd-radar-precip`) auch das instantane Radar-Rate-Produkt **`rzc`** (Precipitation Rate, mm/h, ohne Integration, 5-min-Takt). Das ist das Produkt, das auf meteoschweiz.ch unter „Niederschlag" live animiert wird und Zellen sauber wandern lässt.

### Code-Änderung

In `scripts/ingest_radar.py`:

1. `ASSET_PREFIX["precip"]` von `"cpc"` → `"rzc"`.
2. `RADAR_INGEST_VERSION` auf `"v21-rzc-instant"` bumpen → triggert Auto-Purge der alten 60-min-CPC-PNGs auf R2.
3. Skalen-Anmerkung in `PRECIP_SCALE` aktualisieren (Schwellen passen für mm/h-Rate gleich, RZC ist bereits in mm/h).
4. Log-Zeile in `process_asset` bleibt — wir sehen weiter `ts-odim:` zur Verifikation.

In `.github/workflows/radar-ingest.yml`:

5. `EXPECTED_RADAR_INGEST_VERSION: "v21-rzc-instant"` (sonst schlägt die Pre-Flight-Verifikation fehl).

### Fallback / Risiko

Falls `rzc` in der OGD-Collection nicht enthalten ist (möglich — manche MCH-Produkte sind nur über andere Kanäle offen), bricht der erste Run mit „0 candidate frames" ab und die alten Frames sind gepurgt. Mitigation: In `_extract_assets` zusätzlich `cpc` als Backup zulassen, falls 0 `rzc`-Frames gefunden werden, und im Log warnen. Konkret: nach dem RZC-Scan, wenn `len(assets)==0`, einmaliger Fallback-Scan mit Prefix `cpc` und Warn-Log `WARN: rzc not available, falling back to cpc (60-min smear)`.

Wenn RZC vorhanden ist, sieht der User direkt nach dem ersten erfolgreichen Run (≤10 min nach Commit):

- Zellen wandern sauber statt sich zu strecken.
- Latenz reduziert sich tendenziell auf ~5 min (RZC wird minütlich publiziert; wir nehmen 5-min-Schritte).

### Keine Änderungen im Frontend

`src/components/maps/radar-map.tsx` Snap-Verhalten ist bereits korrekt (`blendNextPng = null`, Z. 879). Wenn RZC sauber wandert, ist Snap genau das richtige Verhalten.

## Verifikation nach Deploy

1. Workflow manuell triggern via `workflow_dispatch`.
2. Log-Zeile `asset ts range: … newest=…` prüfen — sollte ≤5 min hinter „now" sein.
3. Auf `/karten/radar` durchscrubben: aufeinanderfolgende Frames müssen Zellen zeigen, die räumlich verschoben sind, nicht in die Länge gezogen.

## Falls RZC nicht verfügbar ist

Plan B: bei CPC bleiben, aber im UI klar kommunizieren („Messung: gleitender 60-min-Mittelwert MCH CombiPrecip"). Dann muss der User akzeptieren, dass es kein Live-Movement gibt — und wir bauen ggf. ein eigenes Differenz-Bild (frame[t] − frame[t-60min]) für die letzten 5 min, aber das ist deutlich aufwendiger und ungenau.
