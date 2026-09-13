# Favoriten für die Lokalprognose (browserbasiert)

## Ziel
Besucher können Orte als Favoriten speichern und über die Ortssuche schnell wieder aufrufen — ohne Konto, gespeichert im eigenen Browser.

## Verhalten

### Speichern / Entfernen
- Neben dem Ortsnamen (Chips unter dem Suchfeld in der Lokalprognose) erscheint ein **Stern-Button**:
  - Nicht gespeichert: leerer Stern → Tippen speichert den Ort als Favorit.
  - Gespeichert: gefüllter Stern in Akzentfarbe → Tippen entfernt den Favoriten wieder.
- Beim Speichern einer Geolokalisierung wird der aktuelle Ortsname verwendet.
- Favoriten werden als Liste (Name, Breitengrad, Längengrad, Region) in `localStorage` unter `otw:lokal-favorites` abgelegt (analog zu `weather:location` / „Zuletzt gesucht“).

### Anzeige in der Suche
- Das Suchfeld (`LocationSearch`) erhält oberhalb von „Zuletzt gesucht“ einen Abschnitt **„Favoriten“** mit Stern-Icon, sichtbar sobald das Feld leer ist und Favoriten existieren.
- Reihenfolge im Dropdown: Favoriten → Zuletzt gesucht → Vorschläge.
- In der Favoritenliste kann ein Eintrag direkt über ein kleines „×“ entfernt werden (Hover/Fokus).
- Klick auf einen Favoriten lädt sofort die Prognose des Ortes — wie bisher bei den anderen Vorschlägen.

### Geltungsbereich
- Weil Lokalprognose (`weather-widget.tsx`) und Regionskarte (`region-map.tsx`) beide `LocationSearch` verwenden, gilt die Favoritenliste automatisch **überall gemeinsam**.
- Der Stern-Button wird im Header der Lokalprognose ergänzt (und im Regionskarten-Such-Overlay nur, wenn dort ein Ortsname angezeigt wird — sonst entfällt er dort).

### Grenzen
- Max. 12 Favoriten; ältester wird bei Überschreitung entfernt (Hinweis im Code, kein Fehlerdialog).
- Duplikate werden anhand von Koordinaten (gerundet auf 3 Dezimalstellen) erkannt.
- Ungültige/alte Einträge im localStorage werden defensiv ignoriert.

## Technik
- Neuer Hook `src/lib/favorites.ts`: `useFavoritePlaces()` mit `read`, `toggle`, `remove`, `isFavorite` — storage-event-synchron, damit mehrere Karten/Widgets auf derselben Seite konsistent bleiben.
- `location-search.tsx`: neuer Abschnitt „Favoriten“ im Dropdown + Entfernen-Button; bestehende Tastaturnavigation (Pfeiltasten) wird um die Favoriten-Einträge erweitert.
- `weather-widget.tsx` (Header): Stern-Toggle neben dem Orts-Chip; `aria-pressed` und Title-Text („Als Favorit speichern“ / „Favorit entfernen“).
- Keine Backend-/Datenbankänderungen, keine neuen Abhängigkeiten. Icons aus `lucide-react` (Star, X).

## Prüfung
- Typecheck + Build.
- Browser-Test: Ort suchen → Stern setzen → Seite neu laden → Favorit in der Suche sichtbar und auswählbar; Entfernen via Stern und ×; Regionskarte zeigt dieselben Favoriten.
