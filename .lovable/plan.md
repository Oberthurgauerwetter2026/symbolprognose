# Warum keine Push-Meldungen mehr — und wie wir es beheben

## Befund (geprüft)

- Push-Schlüssel (VAPID) sind vorhanden, 11 Abos in der Datenbank — Versand ist technisch möglich.
- Die Gewitter-Automatik läuft: letzter Lauf 17.08. 11:20 Zurich, `detected: 8`, aber `created: 0`.
- Ursache: In der Automatik gibt es je Gemeinde genau **eine** Warnzeile mit festem Schlüssel (`auto-gewitter-<gemeinde>`). Diese Zeile wird nie gelöscht, nur auf „inaktiv“ gesetzt. Beim nächsten Gewitter wird sie nur aktualisiert — und die Push-Meldung wird ausschliesslich beim **ersten** Anlegen verschickt.
- Konkret: alle 20 Gemeinden haben bereits so eine Zeile (älteste vom 05.08., neueste vom 17.08.). Damit löst die Automatik für **keine** Gemeinde mehr eine Push-Meldung aus.
- Manuell erfasste Warnungen im Warn-Tool senden weiterhin (eigener Pfad), sie sind vom Fehler nicht betroffen.

## Behebung

1. In der Automatik nicht mehr „nur bei Neuanlage“ benachrichtigen, sondern bei einem **neuen Warnereignis**:
   - Push senden, wenn die Gemeinde vorher nicht aktiv gewarnt war (Reaktivierung einer inaktiven Zeile gilt als neues Ereignis).
   - Push senden, wenn die Warnstufe gegenüber der laufenden Warnung **steigt** (z. B. Stufe 1 → 2).
   - Kein Push bei blossen Text-/Zeit-Aktualisierungen derselben laufenden Warnung (verhindert Meldungsflut im 5-Minuten-Takt).
2. Zusätzliche Wiederholsperre: pro Gemeinde und Gefahrenart höchstens eine Push-Meldung innerhalb von 45 Minuten, ausser die Stufe steigt.
3. Im Warn-Tool in der Diagnose sichtbar machen, wie viele Push-Meldungen der letzte Automatik-Lauf verschickt hat, damit ein Ausfall künftig sofort auffällt.

## Technische Details

- `src/lib/auto-thunder.server.ts`: vor dem Update den bestehenden Datensatz mit `id, active, level, valid_to` lesen; Benachrichtigung auslösen bei `!existing || existing.active === false || level > existing.level`; ausserdem 45-Minuten-Sperre über `notified_at`.
- Neue Spalte `notified_at timestamptz` auf `public.warnings` (Migration, inkl. bestehender GRANT-Situation unverändert) — nur serverseitig geschrieben.
- `runAutoThunder` gibt zusätzlich `notified` zurück und schreibt den Wert in `public.job_runs` (bestehendes `note`-Feld oder neue Spalte `notified`).
- Keine Änderung an `push.server.ts`, `push-sw.js`, an der Warnkarte oder an den Abo-Daten.
