## Diagnose

Der Run wurde nach ~90 s bei Batch 8 von 48 mit `The operation was canceled` beendet. Das ist **kein** Timeout (Limit ist 15 min) und **kein** Open-Meteo-Fehler (die Retries liefen sauber durch). Es ist `concurrency: cancel-in-progress: true` in `arome-ingest.yml`: sobald ein zweiter `workflow_dispatch` reinkommt, wird der laufende Run gekillt.

Wer den zweiten Dispatch ausgelöst hat: vermutlich der Cron-Worker (15-min-Slot fiel zufällig zusammen) oder ein manueller Re-Run via GitHub-UI während der erste noch lief.

Zusätzliches Risiko unabhängig davon: 48 Batches × ~10 s pro Open-Meteo-Call + 3 s Pause = **~10 min Realzeit pro Run**. Damit fällt fast jeder zweite Cron-Tick (15 min) in einen noch laufenden Vorgänger.

## Lösung in 3 Schritten

### 1. Concurrency-Policy umstellen (eigentlicher Bug)

`.github/workflows/arome-ingest.yml`:

```yaml
concurrency:
  group: arome-ingest
  cancel-in-progress: false   # warten statt killen
```

Doppel-Dispatches reihen sich dann ein statt zu töten. Bei länger laufenden AROME-Runs ist das gewünscht (besser ein verspäteter als ein abgebrochener).

### 2. Weniger / schnellere Batches (Performance)

Open-Meteo erlaubt deutlich mehr als 50 Koordinaten pro Call. Mit größeren Chunks halbiert sich die Anzahl Requests und damit auch die Timeout-Wahrscheinlichkeit:

- `CHUNK_SIZE: "100"` (statt 50) → 24 Batches statt 48
- `BATCH_SLEEP_S: "2"` (statt 3) → spart zusätzlich ~24 s
- `GRID_LAT: "32"`, `GRID_LON: "48"` (statt 40×60) → 1536 statt 2400 Punkte, immer noch **~1.8 km Auflösung** (deutlich feiner als die 5 km von ICON-CH1, die wir verbessern wollen). Output-PNG bleibt mit 8× Upsampling bei 384×256 px — visuell ununterscheidbar.

Effekt: ~16 Batches × ~7 s = **~2 min Realzeit** statt ~10 min. Damit kein Overlap mehr mit dem 15-min-Cron.

### 3. Cron-Frequenz reduzieren (optional, defensiv)

AROME-HD läuft beim Anbieter nur **alle 3 h** ein neues Modell. Alle 15 min triggern ist Verschwendung. In `cron-worker/src/index.ts` auf `minute === 0 && hour % 1 === 0` (= stündlich) reduzieren reicht völlig — schont Open-Meteo-Quote (4600 → 580 Calls/Tag) und reduziert weitere Konkurrenz auf den Workflow.

## Technische Details

**Geänderte Dateien:**

- `.github/workflows/arome-ingest.yml`
  - `cancel-in-progress: false`
  - `CHUNK_SIZE: "100"`, `BATCH_SLEEP_S: "2"`
  - `GRID_LAT: "32"`, `GRID_LON: "48"`

- `cron-worker/src/index.ts`
  - `includeArome = minute === 0` (statt `minute % 15 === 0`), entsprechend 24× pro Tag

**Nicht geändert:**

- `scripts/ingest_arome.py` — bleibt wie es ist, alle Tunables sind ENV-getrieben.
- Frontend (`radar-map.tsx`, `radar.functions.ts`) — die niedrigere Grid-Auflösung wird automatisch in der Manifest-`grid`-Sektion mitgeschickt, aber das PNG-Bbox bleibt identisch, also keine Code-Änderung nötig.

## Verifikation nach Implementation

1. AROME-Ingest manuell triggern → sollte in unter 3 min durchlaufen.
2. R2: `arome/frames.json` mit `frames: [...]` (42 Einträge) und `arome/frames/*.png` neu vorhanden.
3. Karte `/karten/radar` → Toggle „AROME-HD" → Frames erscheinen.

## Nicht im Scope

- Open-Meteo HTTP/2-Keep-Alive (`requests.Session`) — Micro-Optimierung, lohnt erst wenn obige Maßnahmen nicht reichen.
- Async/parallele Batches — Open-Meteo bestraft Parallel-Calls mit 429.
