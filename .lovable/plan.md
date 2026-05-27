## Problem
- Die letzte Migration war ein reiner DB-Hintergrund-Fix (Extensions aus `public` raus) — auf der `/karten/radar`-Seite gibt es deshalb **bewusst** nichts Sichtbares zu sehen.
- Aber: die Server-Logs zeigen **seit 18:30 Uhr keinen einzigen POST** auf `/api/public/radar/ingest-trigger`. Der pg_cron-Job feuert nicht (sollte alle 5 Min laufen, jetzt ist es ~19:18).
- Zusätzlich: selbst wenn er feuert, gibt der **Produktions-Endpoint immer noch 401 zurück**, weil die Code-Änderung (apikey-Header akzeptieren) noch **nicht publishd** wurde — der letzte Live-Code prüft nur `x-trigger-secret`.

## Ursachenanalyse

**1. Cron feuert nicht (vermutlich):** Nach `DROP EXTENSION pg_cron; CREATE EXTENSION pg_cron;` kann es passieren, dass der Background-Worker den neuen Job erst nach einem DB-Restart aufnimmt. Plus: nach Recreate fehlen oft GRANTs auf das `cron`-Schema für `postgres`/`service_role`.

**2. Endpoint-Code noch nicht live:** Die Datei `src/routes/api/public/radar/ingest-trigger.ts` akzeptiert in Preview den `apikey`-Header — aber die Produktion (`symbolprognose.lovable.app` / `project--…lovable.app`) läuft noch auf der alten Version → 401.

## Plan

**Schritt A — Endpoint publishen (du)**
Klick auf "Publish". Damit geht die Code-Änderung live und der `apikey`-Header wird akzeptiert.

**Schritt B — Cron-Job diagnostizieren + ggf. neu schedulen (ich, per Migration)**
Eine neue Migration die:
1. Den alten Job sicher entfernt (`cron.unschedule`).
2. GRANTs auf `cron`-Schema setzt (`GRANT USAGE ON SCHEMA cron TO postgres, service_role;`).
3. Den Job **neu schedulet** mit identischem `extensions.http_post`-Call.
4. Direkt einen Test-Call ausführt (`SELECT extensions.http_post(...)`) und das Ergebnis loggt.
5. Eine kleine Diagnose-View `public.radar_cron_health` anlegt, die letzten 10 Job-Runs + HTTP-Responses zeigt — damit ich/du den Status künftig sehen kann ohne psql-Adminrechte.

**Schritt C — Verifikation**
- Server-Logs prüfen → POST alle 5 Min sichtbar, Status 202.
- `/karten/radar` öffnen → Slider zeigt aktuelle Frames bis "jetzt".

## Reihenfolge
Bitte **erst publishen** (Schritt A), sonst feuert der Cron zwar, bekommt aber weiter 401. Sobald publishd ist, sag Bescheid → ich lege die Diagnose-Migration nach (Schritt B+C).