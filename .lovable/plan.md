Scroll-Schatten für Panels

## Ziel
Beim Scrollen innerhalb von Panels soll ein schwacher Schatten-Effekt erscheinen, der signalisiert, dass noch Inhalt folgt bzw. dass Inhalt oberhalb/unterhalb des sichtbaren Bereichs liegt. Der Effekt soll dezent sein und nicht die eigentliche Inhaltsdarstellung überlagern.

## Betroffene Panels
- Warnkarten-Detail-Panel (`src/components/maps/warn-map.tsx`, Zeile ~733): Liste/Details zu einer gewählten Gemeinde, aktuell `max-h-[300px] overflow-y-auto`.
- Push-Abonnement-Regionenliste (`src/components/warnings/push-opt-in.tsx`, Zeile ~570): Gemeinde-Auswahl, aktuell `max-h-44 overflow-y-auto`.
- Optional: Ortssuch-Dropdown (`src/components/location-search.tsx`, Zeile ~234), falls der Effekt dort ebenfalls gewünscht ist.

## Umsetzung
1. Wiederverwendbare CSS-Utility in `src/styles.css` ergänzen:
   - Klasse `.scroll-shadow` für Container mit `overflow-y-auto`.
   - Verwendet ggf. `background-attachment: local, scroll` mit zwei schwachen Verläufen (oben und unten) oder sticky Pseudo-Elemente.
   - Schattenfarbe: `var(--color-border)` oder `rgba(0,0,0,0.05)` bei hellem Theme, sehr dezent.
   - Kein hartes `box-shadow`, sondern ein weicher Farbverlauf, der nur sichtbar ist, wenn Scrollen möglich ist.

2. Komponenten anpassen:
   - `warn-map.tsx`: Scroll-Container um `.scroll-shadow` erweitern.
   - `push-opt-in.tsx`: Scroll-Container um `.scroll-shadow` erweitern.
   - `location-search.tsx`: Dropdown-Liste optional mit `.scroll-shadow` erweitern.

3. Verhalten:
   - Schatten oben erscheint, wenn nicht ganz oben gescrollt ist.
   - Schatten unten erscheint, wenn nicht ganz unten gescrollt ist.
   - Bei vollständig sichtbarem Inhalt (kein Overflow) kein Schatten.
   - Auf Touch- und Desktop-Geräten gleich.

## Nicht im Scope
- Keine Änderung an Scroll-Position, Scroll-Snap oder Momentum.
- Keine Änderung an Panel-Inhalt, Layoutbreiten oder Höhen.
- Keine neuen Abhängigkeiten.
