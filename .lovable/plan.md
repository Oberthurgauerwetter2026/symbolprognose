## Niederschlags-Icon in Tageskacheln

In den Tageskacheln (DayStrip) soll vor der Niederschlagsmenge in Millimetern ein kleines Icon stehen.

### Änderung
- **Datei:** `src/components/weather-widget.tsx`
- **Ort:** Zeile 578, Niederschlagszeile in der DayStrip-Kachel
- **Detail:** Lucide-Icon `CloudRain` (oder `Droplets`) vor der mm-Zahl einfügen, z. B. `w-3.5 h-3.5 text-zinc-600`. Keine Änderung an Farben, Schriftstärken oder anderen Elementen.

### Nicht im Scope
- Detail-Panel, Radar, Windkarte, Datenlogik