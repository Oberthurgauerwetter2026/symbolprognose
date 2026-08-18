# Quellenangabe überlagert Filmstrip (mobil)

Auf dem Handy bricht die Leaflet-Quellenzeile ("Leaflet | Quelle: Oberthurgauer Wetter · © swisstopo · MeteoSchweiz") auf mehrere Zeilen um und läuft über das Bedienpanel mit Filmstrip. Der Text liegt in Leaflets eigener Ebene und damit über dem Panel.

## Was geändert wird

- Die Quellenzeile bleibt auf schmalen Bildschirmen einzeilig, klein und wird bei Platzmangel mit "…" gekürzt, statt umzubrechen.
- Sie wird oberhalb des überlagerten Bedienpanels platziert (rechts unten am Kartenrand, aber über dem Panel), sodass sie den Filmstrip nie mehr verdeckt.
- Halbtransparenter Hintergrund und dezente Rundung, damit sie auf der Karte lesbar bleibt.
- Gilt für alle Karten mit überlagertem Panel: Niederschlagsradar, Wind, Niederschlagssummen, Warnkarte.

Am Panel selbst, am Filmstrip und an der Kartenlogik wird nichts geändert.

## Technisch

- Neue Utility-Klasse in `src/styles.css` (z. B. `.map-attrib-compact`), die `.leaflet-control-attribution` innerhalb des Kartencontainers unter 640 px anpasst: `max-width` relativ zur Kartenbreite, `white-space: nowrap`, `text-overflow: ellipsis`, `overflow: hidden`, kleinere Schrift, und ein `bottom`-Offset (~Panelhöhe + Abstand), damit sie über dem Panel sitzt.
- Klasse auf den Karten-Wrapper von `radar-map.tsx`, `wind-map.tsx`, `precip-accum-map.tsx` und `warn-map.tsx` setzen (nur Präsentations-Änderung, keine Logik).
- Kontrolle mobil bei 390–402 px Breite: Quellenzeile einzeilig sichtbar, Filmstrip und Buttons vollständig frei.
