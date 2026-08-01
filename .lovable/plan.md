# Warn-Titel im Infopanel auf einer Zeile

## Ziel

Der Titel in der Warnkarten-Kopfzeile (z. B. "Gewitterwarnung (Stufe 1)") soll immer in einer Zeile bleiben und nicht durch automatischen Zeilenumbruch auseinandergerissen werden. Der "Vorinformation"-Chip bleibt daneben sichtbar – bei zu wenig Platz rutscht er sauber in die nächste Zeile, statt den Titel zu zwingen, umzubrechen.

## Verhalten neu

- Titel-Text: `truncate` (einzeilig, mit Auslassungspunkten bei zu geringer Breite).
- Chip: `shrink-0 whitespace-nowrap`, unverändert rechts vom Titel.
- Wenn der Chip nicht mehr neben den Titel passt, bricht die ganze Kopfzeile um (Chip unter den Titel), nicht der Titel selbst.
- Mobile und schmale Embed-Spalten bleiben lesbar.

## Technische Details

- Datei: `src/components/maps/warn-map.tsx`, Kopfzeile der Warnkarte (ca. Zeile 703–726).
- Änderungen:
  - Titel-`span`:
    - `break-words` entfernen,
    - `truncate` hinzufügen,
    - `min-w-0` beibehalten.
  - Container bleibt `flex flex-wrap items-center gap-2` – dadurch bricht der Chip bei Bedarf in die nächste Zeile um.
  - "Vorinformation"-Chip behält `shrink-0 whitespace-nowrap`.
- Keine Datenbank-, Server- oder Konfigurationsänderungen.

## Nicht im Scope

- Keine Änderung der Farben, Schraffur oder der Warnlogik.
- Keine Änderungen an Push-Benachrichtigungen oder der Kartendarstellung.
