# Warum keine Blitze sichtbar sind

`GET https://…r2.dev/lightning/latest.json` → **HTTP 404**. Die Datei existiert schlicht noch nicht in R2. Der Server-Fn fällt daher auf `emptyPayload()` zurück (`strikes: []`) — genau das zeigt auch die letzte Network-Response.

Zwei mögliche Ursachen:
1. Der GitHub-Actions-Workflow `blitzortung-ingest.yml` ist noch nie erfolgreich gelaufen (neu hinzugefügt, Cron greift erst nach Merge auf `main`, oder er schlägt fehl).
2. Selbst wenn er läuft: das Blitzortung-WS-Protokoll ist undokumentiert; wenn `_decode`/`a:111` nicht (mehr) passt, kommen 0 Strikes und die Datei würde zwar geschrieben, wäre aber leer — dann sähen wir aber `HTTP 200` mit `strikes: []`. Der 404 sagt: der Workflow hat noch nicht einmal einen Upload gemacht.

# Plan

1. **Ingest robuster + selbstdiagnostisch machen** (`scripts/ingest_blitzortung.py`)
   - Immer eine Datei schreiben, auch wenn `websockets` fehlt oder alle Endpoints scheitern (bereits so, aber verifizieren).
   - Ein zusätzliches Feld `debug` in den Payload aufnehmen: `{ endpointsTried, endpointOk, rawMessages, decodedOk, strikesInBBox }`, damit wir per `curl` sofort sehen, warum 0 Strikes ankamen.
   - Fallback-BBox-Filter lockern: kurzzeitig auch `strikesGlobal` mitzählen (nur im `debug`-Feld, nicht im UI), um zu erkennen, ob überhaupt Nachrichten reinkommen.

2. **Workflow manuell antriggerbar bestätigen** (`.github/workflows/blitzortung-ingest.yml`)
   - `workflow_dispatch` ist bereits gesetzt. Nach dem Push kannst du den Workflow einmal manuell starten; der Cron greift erst danach zuverlässig.
   - Timeout auf 6 Min anheben (aktuell 5), damit `BO_LISTEN_S=120` + Setup Puffer hat.

3. **Debug-Endpoint erweitern** (`src/routes/api/public/debug/r2-cache.ts`)
   - Zusätzlich `lightning/latest.json` prüfen und `strikes.length`, `generatedAt`, ggf. `debug` ausgeben, damit wir Statuscheck ohne R2-Auth machen können.

4. **UI: kleiner Statushinweis** (`src/components/maps/satellite-map.tsx`)
   - Wenn `showLightning` aktiv und `strikes.length === 0`: dezenter Chip „Keine aktiven Blitze im Alpenraum" statt „stiller" Karte, damit klar ist: Toggle funktioniert, es blitzt nur nicht.

# Was du danach tun musst

- Änderungen mergen, damit der Cron-Workflow auf `main` läuft.
- Einmal **Actions → Blitzortung Ingest → Run workflow** klicken.
- Danach `curl …/lightning/latest.json` → sollte JSON liefern; im `debug`-Feld steht dann, ob überhaupt Nachrichten ankamen.

# Nicht Teil des Plans

- Umstieg auf EUMETSAT MTG LI (aufwendiger, Auth-Setup) — nur wenn Blitzortung dauerhaft keine Daten liefert.
- Änderungen am Fade-/Rendering-Layer selbst (funktioniert, sobald Strikes eintreffen).
