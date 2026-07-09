## Problem

Cloudflare-Cron triggert `/api/public/radar/ingest-trigger` alle 5 min. Wenn ein Ingest-Run länger dauert als 5 min, staut sich in GitHub Actions ein zweiter Run in der `radar-ingest` Concurrency-Queue. Sobald der Worker nochmal triggert, verwirft GitHub den wartenden Run mit:

> Canceling since a higher priority waiting request for radar-ingest exists

Das ist harmlos, aber die Actions-History füllt sich mit „Cancelled" Runs.

## Lösung: Server-seitig entzerren

`src/lib/radar-dispatch.server.ts` hat bereits einen In-Memory-Throttle (`MIN_INTERVAL_MS = 60_000`, 1 min). Das ist zu kurz — der eigentliche Ingest braucht meistens 3–6 min. Wir erhöhen den Throttle so, dass zwischen zwei erfolgreichen Dispatches genug Zeit liegt, dass der vorherige Run typischerweise fertig ist.

### Änderung

**`src/lib/radar-dispatch.server.ts`**
- `MIN_INTERVAL_MS` von `60_000` (1 min) → `4 * 60_000` (4 min).
- Kommentar ergänzen: „verhindert, dass GitHub Actions einen zweiten Run in die `radar-ingest` Concurrency-Queue schiebt und den älteren wartenden Run cancelt".

### Warum 4 min

- Cloudflare-Cron feuert alle 5 min. Bei 4 min Throttle wird jeder Cron-Trigger, bei dem der letzte Dispatch <4 min her ist, mit 429 beantwortet — der Worker loggt „429 throttled" (kein Fehler).
- Der laufende Ingest hat damit typischerweise Zeit zu enden, bevor ein neuer Dispatch in die Queue geht. Cancels durch die 1-Slot-Warteschlange werden selten statt regelmäßig.

### Was NICHT geändert wird

- `.github/workflows/radar-ingest.yml` `cancel-in-progress: false` bleibt — laufende Ingests sollen nicht mitten im Upload abgebrochen werden.
- Cloudflare-Worker Cron (`*/5 * * * *`) bleibt — die 5-min-Kadenz ist für Frame-Freshness sinnvoll, der Server dedupliziert.
- Andere Dispatch-Helper (`arome`, `symbol`, `openmeteo`, `mch`) haben eigene Throttles und sind nicht betroffen.

## Verifikation

- Nach Deploy: GitHub-Actions-History von `radar-ingest` beobachten — Cancels sollten von „fast jedem Run" auf „selten" fallen.
- Cloudflare-Worker `/status` zeigt `lastRadar.status = 429` für Throttle-Fälle statt `202` — gewollt.
