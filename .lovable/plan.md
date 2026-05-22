## Wetter-Icons in Marker-Pills vergrössern

Die `WeatherIcon`-Komponente im `MarkerPill` (Region-Karte) hat aktuell `size={26}`. Auf Wunsch wird die Icon-Grösse erhöht, damit Sonne, Wolke etc. besser sichtbar sind.

**Änderung:**
- In `src/components/region-map.tsx`, Zeile ~115: `size={26}` → `size={34}`
- Falls nötig: Padding/Gap im Pill-Container minimal anpassen, damit das grössere Icon nicht ausgeschnitten wird.

**Technische Details**
- Datei: `src/components/region-map.tsx`
- Komponente: `MarkerPill`
- Keine neuen Abhängigkeiten.