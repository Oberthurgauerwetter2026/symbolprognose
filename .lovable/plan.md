# Radar-Prognose endet um 17 Uhr — Ursache und Fix

## Was ich gemessen habe

- Das Prognose-Manifest im Speicher (`radar/forecast-frames.json`) wurde zuletzt am **26.08. um 15:09 UTC** erzeugt — also über 28 Stunden alt.
- Sein letzter Frame liegt bei `2026-08-28T15:00Z` = **17:00 Uhr Schweizer Zeit**. Genau da bricht die Prognose im Filmstrip ab.
- Auch der Modell-Cache `openmeteo/forecast.json` stammt vom 26.08., 15:13 UTC.
- Die Radar-**Messung** ist dagegen aktuell (Manifest 27.08., 19:17 UTC) — nur die Prognose ist eingefroren.
- Grund: Der Prognose-Ingest-Lauf vom **26.08., 15:30 UTC hängt seit damals im Status „queued“** (GitHub-Actions-Störung). Seither wurde kein einziger neuer Lauf gestartet.
- Warum kein neuer Lauf: Die Dispatch-Logik für den Prognose-Ingest blockiert jeden neuen Trigger, solange ein Lauf „queued/in_progress“ ist — ohne Zeitgrenze. Für den Radar-Ingest wurde diese Zeitgrenze („nach 12 Min. gilt ein wartender Lauf als verwaist“) bereits eingebaut, für Prognose und Symbolprognose fehlt sie.

Kurz: Ein einzelner hängender Lauf hat die Prognose-Pipeline seit gestern Nachmittag dauerhaft lahmgelegt.

## Fix

1. **Hängenden Lauf beenden und Pipeline sofort neu anstossen**, damit die Prognose wieder bis +48 h reicht.
2. **Verwaiste Läufe automatisch überspringen:** Der Prognose-Ingest (und analog die Symbolprognose) nutzt künftig dieselbe Stale-Queued-Erkennung wie der Radar-Ingest — wartet ein Lauf länger als 12 Minuten in der Warteschlange, wird er abgebrochen und ein neuer Lauf gestartet, statt alles zu blockieren.
3. **Frische-Wächter:** Ist das Prognose-Manifest älter als ~90 Minuten, wird das im Admin-Tool (Datenquellen-Status) klar als veraltet markiert, inklusive Alter und letztem Prognose-Zeitpunkt — so fällt so ein Stillstand künftig sofort auf, statt erst durch den abgeschnittenen Filmstrip.

Die Darstellung/Animation der Prognose bleibt unverändert (weiterhin glatt und PNG-basiert, keine Blöcke).

## Technische Details

- `src/lib/openmeteo-dispatch.server.ts`: `fetchRecentRuns`/Active-Run-Check durch `getWorkflowActivity({ staleQueuedAfterMs })` aus `gh-dispatch.server.ts` ergänzen; bei `stuckQueued` → `cancelWorkflowRun` + Dispatch erlauben (Muster aus `radar-dispatch.server.ts`).
- `src/lib/symbol-dispatch.server.ts`: gleiche Behandlung, damit die Symbolprognose nicht dasselbe Schicksal erleidet.
- `src/lib/ingest-admin.functions.ts` + `src/routes/admin-warnungen.tsx`: Prognose-Manifest-Alter (`generatedAt`) und letzter Frame-Zeitpunkt in die Diagnose aufnehmen, Status „veraltet“ ab 90 Min.
- Einmalige Bereinigung: hängender Run abbrechen, `openmeteo-ingest.yml` neu dispatchen, danach `forecast-frames.json` auf `generatedAt`/letzten Frame prüfen.
