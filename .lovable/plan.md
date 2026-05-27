# Radar-Lücken beheben

## Diagnose

Ich habe das Live-Manifest und R2 geprüft:

- **Manifest** (`radar/frames.json`, generatedAt `12:52:30Z`, jetzt ~13:32Z) listet 269 Frames für die letzten 24h.
- **Ein großes Loch**: `03:30Z → 05:05Z` (95 min). Hier ist der Cron komplett ausgefallen.
- **Viele kleine Mini-Lücken**: einzelne Frames haben nur `hailUrl`, aber kein `precipUrl` (Beispiel `12:45Z`: hail=200, precip=404). Im Animations-Loop erscheint dann ein leeres Bild → genau die "Unterbrechungen", die du siehst.
- **Manifest ist 40 min alt** trotz `*/5 * * * *` Cron → GitHub Actions feuert nicht zuverlässig (bekanntes GH-Verhalten unter Last).

Es sind also **zwei** Ursachen, die zusammen wirken:
1. Einzelne Produkt-Uploads (precip ODER hail) schlagen fehl, der andere geht durch → Frame ist halb-leer.
2. Der GH Actions Cron läuft nicht stabil alle 5 min.

## Was ich ändere

### 1. Ingest robuster pro Asset (`scripts/ingest_radar.py`)

- `process_asset()` in `try/except` einpacken: ein Fehler bei einem einzelnen Timestamp/Produkt darf den Rest des Laufs nicht abbrechen — wird geloggt und übersprungen.
- Im Fehlerfall **keinen** „Leichen"-Key in R2 hinterlassen (heute kann `upload_png` nach erfolgreichem `put_object` durch eine spätere Exception passieren — kleine Reihenfolgen-Korrektur).
- Pro Asset bis zu 2 Mal innerhalb desselben Laufs retryen (zusätzlich zu den bereits bestehenden HTTP-Retries in `http_get`), bevor übersprungen wird.
- Am Ende eine **Lückenstatistik** loggen (`expected vs uploaded vs skipped`), damit man im Actions-Log sofort sieht ob etwas systematisch fehlt.

### 2. Client-seitiges Carry-Forward (`src/components/maps/radar-map.tsx` + `src/lib/radar.functions.ts`)

- In `radar.functions.ts` beim Mapping des Manifests: wenn `precipUrl` für einen Frame fehlt, **vom vorigen Frame übernehmen** (Forward-Fill, max. 3 Frames = 15 min, danach wirklich leer lassen). Gleiches für `hailUrl`.
- Dadurch verschwinden die kurzzeitigen Aussetzer in der Animation komplett, ohne falsche Daten anzuzeigen (nur sehr kurze Persistenz des letzten gültigen Bildes).
- Optional: kleines dezentes Badge „Zwischenbild" wenn ein Frame durch Carry-Forward gefüllt wurde — nur wenn du das willst, sage Bescheid.

### 3. Cron-Zuverlässigkeit

GitHub Actions garantiert keinen genauen 5-min-Takt. Zwei Optionen — bitte wählen:

- **(a) Doppelter GH-Cron mit Offset** (einfachster Schritt): zusätzlich `2,7,12,...` neben `*/5`. Reduziert Aussetzer, löst sie aber nicht ganz.
- **(b) Externer Trigger** (empfohlen für „wirklich alle 5 min"): ein winziger Cloudflare Worker mit Cron Trigger (alle 5 min) pingt einen neuen Endpoint `/api/public/radar/ingest-trigger`, der via `workflow_dispatch` den GH-Job startet. Braucht einmalig einen GitHub PAT als Cloud-Secret.

Im ersten Schritt würde ich **(a)** als Quick-Win machen und (b) nur einbauen, wenn du es willst.

## Technische Details

- `scripts/ingest_radar.py`: nur `process_asset` und die Schleife in `main()` anfassen, sowie ein neuer Log-Block am Ende. Version-Bump auf `v7-resilient`. `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` mitziehen.
- `src/lib/radar.functions.ts`: die Schleife `for (const mf of manifest!.frames)` (Zeilen ~164) bekommt einen kleinen Pre-Pass, der `precipUrl`/`hailUrl` per Carry-Forward mit Limit auffüllt.
- `radar-map.tsx`: bleibt funktional unverändert; der bereits vorhandene `blendNext`-Fallback wird durch das Forward-Fill obsolet → kann später vereinfacht werden, aber nicht in dieser Runde.

## Was ich NICHT ändere

- Keine Änderungen am Map-Rendering, an den Farbskalen oder am Layout.
- Keine Änderung der R2-Struktur oder der Manifest-Schema.

## Frage an dich

Soll ich für Cron-Zuverlässigkeit **(a)** Quick-Win machen, oder direkt **(b)** mit Cloudflare-Trigger?
