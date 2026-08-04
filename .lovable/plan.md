# Warnkarte: Aktualisierungszeit anzeigen

Die Warnkarte zeigt derzeit keinen Zeitstempel, wann die Warnlage zuletzt geladen wurde.

## Änderung

- Unten rechts über der Karte (dezent, halbtransparent) erscheint „Aktualisiert 04.08.2026, 13:12“.
- Der Wert kommt aus dem letzten erfolgreichen Datenabruf und aktualisiert sich automatisch bei Realtime-Änderungen und beim 60-Sekunden-Refresh.
- Während des Ladens bzw. ohne Daten wird nichts angezeigt (kein Platzhaltersprung).
- Gilt auch für die Standalone-Seite `/warnkarte` und das Embed, da dieselbe Komponente verwendet wird.

## Technisch

- `src/components/maps/warn-map.tsx`: `dataUpdatedAt` bzw. `data.updatedAt` aus dem bestehenden `useQuery` nutzen und mit `Intl.DateTimeFormat("de-CH", { dateStyle: "short", timeStyle: "short" })` (Zeitzone Europe/Zurich) formatiert als kleines Overlay-Badge rendern.
- Keine Backend-Änderung nötig; `listWarnings` liefert `updatedAt` bereits.
