## Diagnose

- `radar/forecast-frames.json` liefert an R2 **404** — das Prognose-Manifest existiert also noch nicht.
- Der Open-Meteo-Cache (`radar/frames.json`) ist **48 min alt** (`generatedAt 14:29Z`, jetzt 15:17Z). Der 5-Minuten-Cron des Cloudflare-Workers hat seither offenbar keinen Ingest erfolgreich abgeschlossen.
- Ursache mit hoher Wahrscheinlichkeit: der neue **Dense-Grid-Fetch (120×140 = 16 800 Punkte)** überschreitet Timeout/Rate-Limit des Open-Meteo-Endpoints. Jeder Chunk (200 Pkt) muss `minutely_15` × 45 h für 200 Locations liefern; 84 Chunks à 2 Worker sind grenzwertig lang, und ein einziges 429/500 bricht `chunk_fetch("phase1", …, optional=True)` sauber ab → dann kommt Fallback auf alten Cache, aber `phase1_dense` bleibt `None` → **keine Forecast-PNGs, kein Manifest**.
- Client rendert dann korrekt nur Mess-Frames (letztes `15:10Z`, 8 min alt) — deshalb sieht der User "keine Prognose".

## Ziel

Prognose-PNGs zuverlässig erzeugen, ohne die Native-Optik zu opfern.

## Änderungen

### 1. Dense-Grid moderat verkleinern (`.github/workflows/openmeteo-ingest.yml`)

- `GRID_LAT_DENSE: 80`, `GRID_LON_DENSE: 96` → ~1.8 km / ~1.9 km (nahe ICON-CH2-nativ, immer noch ~10× dichter als vorher).
- 7 680 Punkte × 45 h/15 min bleibt in ~40 Chunks à 200 → sicher innerhalb Open-Meteo-Budget.
- `CHUNK_PHASE1: 180`, `FETCH_WORKERS: 3` — höhere Parallelität, kleinere Antworten.

### 2. Härtere Fehlermeldung + Teil-Erfolg (`scripts/ingest_openmeteo.py`)

- In `chunk_fetch` bei `optional=True`: pro Chunk **retry mit backoff** (2×) statt sofort abzubrechen. Nur wenn > 20 % aller Chunks scheitern, `None` zurückgeben.
- Beim `phase1_dense`-Fallback zusätzlich **loggen, warum** (`HTTP-Status`, letzte Fehler-URL), damit die GitHub-Action-Logs die Ursache zeigen.
- Wenn `phase1_dense` verfügbar ist, `rasterize_forecast_pngs` **auch bei bereits vorhandener alter Cache-Rückkehr** aufrufen (heute nur wenn frischer Fetch); reduziert Nachlauf-Ausfälle.

### 3. Zusätzlicher Debug-Endpoint

- `src/routes/api/public/debug/r2-cache.ts` um `forecastManifest: { url, ageSeconds, frameCount, latestT }` erweitern, damit sich der Status künftig ohne R2-Auth prüfen lässt.

### 4. Client-Fallback (`src/components/maps/radar-map.tsx`)

- Wenn `radarData.hasRealRadar === true` **aber keine Frames mit `t > now`** existieren, sichtbaren Banner einblenden: „Prognose-Layer wird gerade neu berechnet". Aktuell fehlt jeder Hinweis, deshalb wirkt es wie ein UI-Bug.

## Technische Details

- Kein Wechsel an Farbskala / Bbox — die Grössenverhältnisse aus dem letzten Turn bleiben erhalten (Prognose ~1.8 km, Messung ~1 km, Faktor ~2, für Auge quasi identisch).
- Kein `crossfade` / kein `denoise` — Rasterung bleibt 1:1 zur Messung.
- Der Cron-Worker triggert die Action weiterhin alle 5 min; sobald ein erfolgreicher Lauf durch ist, erscheinen sofort ~192 Frames (jetzt … +48 h alle 15 min).

## Verifikation

1. Workflow manuell anstossen; GitHub-Action-Log muss `forecast-pngs: uploaded N frames` und `forecast-manifest: N entries` zeigen.
2. `curl https://pub-2273d…r2.dev/radar/forecast-frames.json` → 200 mit ≥ 100 Einträgen.
3. Preview `/karten/radar`: Timeline zeigt neben den Mess-Frames auch Frames > jetzt; Formen bleiben organisch, identisch zur Messung.
