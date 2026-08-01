# Archiv: „Alle löschen"-Button

## Aktueller Zustand

Abgelaufene Warnungen werden automatisch auf inaktiv gesetzt und landen im Abschnitt „Beendet / abgelaufen". Gelöscht wird dabei nichts – die Einträge bleiben dauerhaft in der Datenbank stehen. Löschen ist bisher nur einzeln pro Eintrag möglich.

## Änderung

Im Kopf des Abschnitts „Beendet / abgelaufen" kommt ein Button „Alle löschen" dazu:

- sichtbar nur, wenn das Archiv Einträge enthält
- Sicherheitsabfrage („X Einträge endgültig löschen?") vor dem Löschen
- löscht alle inaktiven bzw. abgelaufenen Warnungen samt zugehörigen Gemeinde-Zuordnungen
- aktive, noch gültige Warnungen bleiben unangetastet
- danach werden Liste und Kartenvorschau neu geladen

## Technische Umsetzung

- `src/lib/warnings.functions.ts`: neue Server-Funktion `deleteArchivedWarnings` (Passwort-Check über `assertAdmin`), löscht via Admin-Client alle Warnungen mit `active = false` oder `valid_to < now()`; `warning_regions` folgt über die FK-Kaskade. Gibt die Anzahl gelöschter Zeilen zurück.
- `src/routes/admin-warnungen.tsx`: Button im Archiv-Header, `window.confirm`, Aufruf über den bestehenden `act()`-Helper, damit Liste und Vorschau refreshen.
