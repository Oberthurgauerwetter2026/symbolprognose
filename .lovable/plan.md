## Befund (verifiziert)

- Das Radar-Manifest in R2 (`radar/frames.json`) hat als letzten Mess-Frame **28.07.2026 13:25 UTC**, `generatedAt` 13:26 UTC — also rund 24 h alt.
- Die Anzeige filtert Messframes auf die letzten 6 Stunden (`pastCutoff = now - 6h` in `src/lib/radar.functions.ts`). Alle vorhandenen Frames sind älter → es bleibt **keine Messung** übrig, nur die Prognose.
- Serverlog zeigt die Ursache: der Cron-Worker-Aufruf
  `POST /api/public/radar/ingest-trigger → 401`
  Der Trigger wird also abgewiesen, der GitHub-Ingest läuft seither gar nicht mehr. Zeitlich passt das zur letzten Änderung an der Trigger-Absicherung.
- Zusätzlich zeigt das Log, dass der Worker auf die **Preview-URL** (`project--…lovable.app`) zielt, nicht auf die Produktions-URL.

## Plan

1. **Trigger-Secret abgleichen (eigentliche Ursache)**
   - Wert von `RADAR_TRIGGER_SECRET` in den Projekt-Secrets neu setzen bzw. neu generieren und exakt denselben Wert im Cloudflare-Cron-Worker (`RADAR_TRIGGER_SECRET`) hinterlegen. Den Worker-`TARGET_URL` auf die stabile Produktions-URL zeigen lassen.
   - Danach den Ingest einmal manuell antriggern und prüfen, dass die Antwort 202 statt 401 ist.

2. **Verifikation**
   - `radar/frames.json` erneut abrufen: `generatedAt` muss aktuell sein und der jüngste Frame innerhalb der letzten ~15 min liegen.
   - `/karten/radar` im Browser prüfen: Mess-Frames sichtbar, kein Hinweis „MCH-Radarmessungen temporär nicht verfügbar“.

3. **Robustheit, damit der Ausfall nicht stumm bleibt**
   - Im Radar-UI eine deutliche Statuszeile zeigen, wenn Messframes vorhanden, aber älter als ~30 min sind bzw. ganz fehlen („Messung seit X min nicht aktualisiert“) statt nur einer generischen Warnung.
   - Der Trigger-Endpoint loggt bei 401 künftig einen expliziten Hinweis (ohne Secret-Inhalte), damit Fehlkonfigurationen sofort in den Logs auffallen.

### Technische Details
- Betroffene Dateien: `src/routes/api/public/radar/ingest-trigger.ts` (Logging), `src/components/maps/radar-map.tsx` bzw. `src/lib/radar.functions.ts` (Staleness-Hinweis), `cron-worker/wrangler.toml` (Ziel-URL).
- Es wird nichts an der Bildverarbeitung/Optik geändert; der Datenfluss selbst ist intakt, sobald der Trigger wieder greift.

### Was ich von dir brauche
Das Cloudflare-Worker-Secret kann ich nicht selbst setzen — den neuen Wert musst du im Worker hinterlegen (`wrangler secret put RADAR_TRIGGER_SECRET`) bzw. mir bestätigen, welchen Wert ich projektseitig setzen soll.
