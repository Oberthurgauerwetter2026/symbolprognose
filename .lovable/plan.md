# Gewitter-Autowarnung: Prüfintervall verkürzen

Heute läuft die automatische Gewitterprüfung nur alle 15 Minuten (der Cron feuert alle 5 Minuten, die Warnprüfung wird aber auf `Minute % 15 == 0` gefiltert). Das soll auf alle 5 Minuten verkürzt werden — das ist die kürzeste Taktung, die der bestehende Cron-Trigger hergibt.

## Änderung

- Die Warnprüfung wird bei jedem 5-Minuten-Lauf mit ausgeführt statt nur alle 15 Minuten.
- Damit wird eine aufziehende Zelle bis zu 10 Minuten früher erkannt; Vorlaufzeit (30 Min. vor Eintreffen) und Schwellenwerte bleiben unverändert.
- Keine Änderung an Warntexten, Stufen oder Push-Verhalten. Bereits bestehende automatische Warnungen werden beim häufigeren Lauf nur aktualisiert bzw. beendet, nicht doppelt gepusht.

## Technische Details

- `cron-worker/src/index.ts`: `includeWarn` von `minute % 15 === 0` auf `true` setzen (Cron `*/5 * * * *`).
- Keine Anpassung an `src/lib/auto-thunder.server.ts` nötig; die Funktion ist idempotent (`setWarningRegions` überschreibt den Zustand).
- Der Warn-Endpunkt `/api/public/warnings/auto-thunder` unterliegt nicht dem 4-Minuten-Throttle der Radar-Ingest-Dispatch-Logik, ein 5-Minuten-Takt ist also unproblematisch.
- Der Cron-Worker muss nach der Änderung neu deployt werden, damit der schnellere Takt greift.
