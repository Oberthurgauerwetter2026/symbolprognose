## Ziel
Die Warnung "Extension in Public" beheben, indem `pg_cron` und `pg_net` aus dem `public`-Schema in ein dediziertes `extensions`-Schema verschoben werden.

## Hintergrund
Die letzte Migration hat `pg_cron` und `pg_net` ohne `SCHEMA`-Klausel angelegt → Default = `public`. Der Linter flaggt das als Warnung (Namenskonflikte, schlechte Schema-Hygiene).

## Vorgehen — eine Migration

1. **`extensions`-Schema anlegen** (falls nicht vorhanden).
2. **`pg_net` verschieben** mit `ALTER EXTENSION pg_net SET SCHEMA extensions;` — `pg_net` ist relocatable.
3. **`pg_cron` behandeln**: Die Extension selbst ist **nicht** relocatable und legt Objekte zwingend im `cron`-Schema an. Praktisch bedeutet das: `pg_cron` bleibt wo es ist (üblicherweise eh `pg_catalog`/`cron`). Hier:
   - `DROP EXTENSION pg_cron;` (entfernt nebenbei die geplanten Jobs).
   - `CREATE EXTENSION pg_cron;` ohne `SCHEMA`-Klausel → installiert sauber in `pg_catalog` (Standardweg, kein public-Eintrag mehr).
   - Den Radar-Cron-Job (`radar-ingest-every-5min`, alle 5 Min) anschließend neu schedulen — identischer `net.http_post`-Call wie in der vorherigen Migration.
4. **Verifikation** nach dem Run:
   - `SELECT extname, nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE extname IN ('pg_cron','pg_net');` → keine Zeile mehr mit `public`.
   - `SELECT jobname FROM cron.job;` → enthält `radar-ingest-every-5min`.
   - Security-Scan erneut ausführen → Warnung weg.

## Risiko / Auswirkung
- Sehr kurze Lücke (Sekunden) im Cron-Scheduling während der Migration. Nächster Tick läuft ≤5 Min später ohnehin. GitHub-Actions-Backup-Trigger besteht weiter.
- Keine App-Code-Änderung nötig — die Endpoint-Logik bleibt identisch.

## Nach Bestätigung
Ich wechsle in Build-Mode und führe die Migration über das Supabase-Migrations-Tool aus.