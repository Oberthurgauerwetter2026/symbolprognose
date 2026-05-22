## Stündliche Werte in den Karten-Markern anzeigen

Aktuell zeigen die Marker auch im Stündlich-Modus immer Tages-Min/Max. Im Stündlich-Modus sollen sie stattdessen die prognostizierten Stundenwerte zeigen.

### Änderung in `src/components/region-map.tsx`

`MarkerPill` bekommt einen Modus-Switch:

- **daily** (unverändert): Symbol + Tages-Min (hellblau) + Tages-Max (dunkelblau).
- **hourly** (neu): Symbol + aktuelle Stunden-Temperatur , ohne Wind.

### Datenfluss

`SpotMarker` reicht im `hourly`-Modus diese Felder an `MarkerPill`:

- `temperature_2m[absoluteHour]`
- `windspeed_10m[absoluteHour]`
- `winddirection_10m[absoluteHour]` (für Drehung des Pfeil-Icons)
- `weathercode[absoluteHour]`, `isDay`

Im `daily`-Modus bleibt alles wie heute.

### Icon-Größe

Beibehalten (190×60). Die Stunden-Variante ersetzt die zwei Temp-Pillen durch eine Temp-Pille + Wind-Zeile, also gleicher Platz.

### Was nicht geändert wird

- Layout der Karte, Tab-Leiste, Slider, Datenstand bleiben unverändert.
- Lokalprognose-Widget bleibt unangetastet.