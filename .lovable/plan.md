# Einheitliches Ortssuchfeld in Regionskarte und Lokalprognose

## Ziel

Das Suchfeld aus der Regionskarte (halbtransparentes Band mit Vorschlägen und den letzten
3 Suchen) wird zur gemeinsamen Komponente und ersetzt das alte, andersartige Suchfeld
„Gemeinde suchen…“ im Header der Lokalprognose.

## Was gebaut wird

1. Neue gemeinsame Komponente `src/components/location-search.tsx`
   - Enthält die heutige Logik aus `MapSearchBar` (300 ms Debounce, `searchLocations`,
     Klick-außerhalb schließt, Escape/Enter-Handling) und den Verlauf der letzten 3 Orte
     im gemeinsamen `localStorage`-Schlüssel `otw:lokal-recent`.
   - Zwei Darstellungsvarianten:
     - `variant="overlay"` — wie heute in der Regionskarte: schwebendes Band
       (`absolute left-2 right-2 top-2`, `bg-primary/30`, `backdrop-blur-sm`).
     - `variant="inline"` — für den Header der Lokalprognose: gleiche Struktur, Suchicon
       und Dropdown, aber Kartenoptik im Formularstil (Höhe 40 px, Karten-/Border-Tokens),
       passend zur bestehenden Kopfzeile neben dem Button „Ortung“.
   - Verhalten bei Auswahl über Prop:
     - `onSelect(location)` — die Lokalprognose übernimmt den Ort direkt in der Ansicht.
     - ohne `onSelect` (Regionskarte) — Navigation zu `/karten/lokal` bzw. neuer Tab im
       Embed-Modus, unverändert wie heute.
   - Verlauf wird in beiden Fällen aktualisiert, also auch wenn in der Lokalprognose
     gesucht wird. Damit teilen beide Karten die „Zuletzt gesucht“-Liste.

2. Regionskarte umstellen
   - `MapSearchBar` in `region-map.tsx` entfernen und durch die neue Komponente
     (`variant="overlay"`) ersetzen; Optik bleibt identisch.

3. Lokalprognose umstellen
   - Im `Header` von `weather-widget.tsx` das bisherige Input samt eigenem Dropdown und
     eigener `["geo", …]`-Query durch die neue Komponente (`variant="inline"`,
     `onSelect={onSelectLocation}`) ersetzen.
   - `hideSearch` weiterhin respektieren (z. B. bei `lockedLocation`), Button „Ortung“ und
     der Rest des Headers bleiben unverändert.

## Technische Hinweise

- Betroffene Dateien: neu `src/components/location-search.tsx`; angepasst
  `src/components/region-map.tsx`, `src/components/weather-widget.tsx`.
- `GeoLocation`-Typ aus `@/lib/weather` wird für `onSelect` verwendet, damit die
  bestehende Ortsauswahl der Lokalprognose ohne Umbau weiterläuft.
- Nach der Umstellung sind die ungenutzten Teile (`searchLocations`-Import, `useDebounced`
  nur falls nicht mehr gebraucht) in `weather-widget.tsx` zu entfernen.

## Prüfung

Suche in Regionskarte (führt weiter zur Lokalprognose) und in der Lokalprognose (wechselt
den Ort direkt) testen, inklusive Vorschlagsliste der letzten 3 Orte in beiden Ansichten;
Darstellung per Screenshot auf Desktop und Mobile prüfen.
