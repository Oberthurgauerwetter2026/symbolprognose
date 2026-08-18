# Quellenangabe auf der Radarkarte aufräumen

Aktuell steht die Quellenzeile auf dem Handy angehoben mitten in der Karte (damit sie den Filmstrip nicht verdeckt), und darunter folgt noch eine zweite, lange Quellen-/Aktualisierungszeile unter dem Bedienpanel. Beides zusammen ist doppelt und sieht unruhig aus.

## Änderungen

1. **Keine schwebende Quellenzeile mehr in der Karte** — die eingeblendete Leaflet-Zeile wird auf schmalen Bildschirmen nicht mehr angehoben und nicht mehr über der Karte angezeigt. Damit ist die Kartenfläche frei.
2. **Eine einzige, kurze Quellenzeile unterhalb des Bedienpanels** — ersetzt die bisherige lange Fussnote:
   `Aktualisiert 15:45 · Quelle: Oberthurgauer Wetter · © swisstopo · MeteoSchweiz`
   Klein, gedämpft, einzeilig; swisstopo bleibt verlinkt (Lizenzpflicht). Die ausführliche Modell-Aufzählung (Radar POH, ICON-CH1, ICON-seamless) entfällt aus der Fussnote — sie bleibt im aufklappbaren Info-Panel („i") erhalten.
3. Gleiche Behandlung für die Karten mit überlagertem Panel: Wind und Warnkarte behalten ihre bestehende Fusszeile, die schwebende Anhebung entfällt dort ebenfalls.

Auf dem Desktop ändert sich nichts an der Kartenoptik ausser der kürzeren Fusszeile.

## Technisch

- `src/styles.css`: `.map-attrib-lift`-Regel entfernen; unter 640 px die Leaflet-Attribution in `.map-attrib-compact` ausblenden (`display: none`), da die Fusszeile die Attribution übernimmt.
- `src/components/maps/radar-map.tsx`: Klasse `map-attrib-lift` entfernen; Fussnote (Z. ~2667–2685) auf die kurze Zeile mit swisstopo-Link kürzen, Blitz-Attribution bleibt bedingt erhalten.
- `src/components/maps/wind-map.tsx`: `map-attrib-lift` entfernen; Fusszeile ggf. um `© swisstopo` ergänzen, falls dort noch nicht vorhanden.
- Prüfung mobil bei 402 px: Karte ohne Text-Overlay, Filmstrip frei, eine Quellenzeile unter dem Panel.
