# Warnzeiten in Push-Meldungen auf Schweizer Zeit fixieren

## Problem

Die Zeitangabe „Gültig: …“ in Push-Meldungen wird aus `formatRange()` erzeugt. Diese Funktion liest Datum/Uhrzeit mit lokalen Gettern (`getHours()`, `getDate()`), also in der Zeitzone der Umgebung. Push-Meldungen werden serverseitig erzeugt, und der Server läuft in UTC. Dadurch erscheint die Warnzeit im Sommer 2 Stunden (im Winter 1 Stunde) in der Vergangenheit — genau das beobachtete Verhalten.

Betroffen sind alle serverseitig gerenderten Zeitausgaben, nicht nur Push:
- Push-Text (`Gültig: …`)
- serverseitige Embed-/Noscript-Ausgaben
- serverseitige Snapshot-Zeitstempel

Im Browser ist die Anzeige korrekt, weil dort die Gerätezeitzone Europe/Zurich ist.

## Lösung

Zeitformatierung fest auf `Europe/Zurich` setzen, statt auf die Zeitzone der ausführenden Umgebung.

1. `formatRange()` in `src/lib/warnings-config.ts` auf eine zeitzonenfeste Formatierung umstellen (`Intl.DateTimeFormat` mit `timeZone: "Europe/Zurich"`), Ausgabeformat bleibt unverändert: `10.08. 20:00 – 10.08. 23:00 Uhr`.
2. Eine kleine gemeinsame Hilfsfunktion für Zürich-Zeit ergänzen und in den serverseitigen Zeitausgaben verwenden:
   - `src/lib/snapshot.server.ts` (Zeitstempel im Snapshot)
   - `src/lib/embed-noscript.server.ts` und die serverseitig gerenderten Noscript-Embeds
3. Kontrolle, dass die Push-Erzeugung in `src/lib/push.server.ts` danach die korrekte Zürcher Zeit enthält.

Die Client-Karten (Warnkarte, Regionskarte, Lokalprognose, Admin-Tool) zeigen anschliessend identische Zeiten wie die Push-Meldung, da beide dieselbe zeitzonenfeste Funktion nutzen.

## Technische Hinweise

- Sommer-/Winterzeit wird von `Intl` automatisch korrekt behandelt; keine feste Offset-Rechnung.
- Kein Datenbank- oder Schema-Eingriff: die in `warnings` gespeicherten `timestamptz`-Werte sind korrekt, nur die Darstellung war falsch.
- Prüfung nach der Umsetzung: eine Testwarnung im Admin-Tool anlegen und Titel/Zeit der eingehenden Push-Meldung mit der Warnkarte vergleichen.
