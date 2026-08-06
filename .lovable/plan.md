# Quellenangaben korrigieren

## Warnkarte

Die Fußzeile nennt aktuell "Warnkriterien nach MeteoSchweiz · Gewitter-Autowarnung aus MeteoSchweiz Radar (CPC & POH)". Diese Zusätze entfallen. Neue Zeile:

`Aktualisiert <Datum/Zeit> · Quelle: Oberthurgauer Wetter · Radar MCH`

Betroffen: `src/components/maps/warn-map.tsx` (Fußzeile unter Karte und Seitenpanel).

## Satellitenbild

Die Quellenangabe liegt momentan als schwebende Pille über der Karte, unten links, und überlagert damit den Filmstrip-Bereich. Sie wird stattdessen als normale Textzeile unterhalb der Karte samt Steuerpanel ausgegeben — gleiche Optik wie bei Radar, Wind und Niederschlagssummen (kleine, gedämpfte Schrift, linksbündig).

Inhalt bleibt: `Quelle: Oberthurgauer Wetter · EUMETSAT · Meteosat-12 (MTG-FCI HRFI) GeoColour` (regionsabhängig aus den Daten).

Nicht angezeigt wird die Zeile in den Embed-/Loop-Varianten (`loop`), damit die Widget-Ansicht unverändert bleibt.

## Technische Umsetzung

- `src/components/maps/warn-map.tsx`: Text der Quellenzeile kürzen.
- `src/components/maps/satellite-map.tsx`: Den absolut positionierten Quellen-Block (`absolute bottom-2 left-3 …`) entfernen und stattdessen nach dem Steuerpanel als statische Zeile im Fluss rendern (`text-[11px] text-muted-foreground`, mit Innenabstand); im `bare`/`loop`-Modus weiterhin ausblenden, da dort keine Fußzeilenfläche existiert.
