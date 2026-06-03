## Ziel

Wetter-Icons auf der Region-Karte deutlich präsenter machen: Icon 64 px, sitzt links ausserhalb der Pill und überlappt sie leicht.

## Änderungen

Datei: `src/components/region-map.tsx` (RegionMarker, ca. Zeilen 178–248)

1. **Pill-Container** auf `position: relative` setzen, linkes Padding erhöhen (z. B. `padding: "8px 16px 8px 44px"`), damit der Text nicht unter das Icon rutscht. `overflow: visible` sicherstellen (Default — kein Clip).
2. **WeatherIcon** aus dem Flex-Fluss nehmen und absolut positionieren:
   - `size={64}` (statt 40)
   - Wrapper-`<span>` mit `position: absolute; left: -14px; top: 50%; transform: translateY(-50%); pointer-events: none;`
   - Leichter Schatten (`filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25))`), damit das Icon vor hellen Karten-Hintergründen lesbar bleibt.
3. **Gap** zwischen Icon und Textspalte entfällt (Icon ist absolut), Text-Block bleibt unverändert.
4. Leaflet-`divIcon` Anker: prüfen, dass `iconAnchor` / `iconSize` die neue Gesamtbreite inkl. überhängendem Icon abdecken — falls der Marker derzeit fix dimensioniert ist, Breite/Anker entsprechend nach links verschieben (Icon ragt 14 px nach links + 64 px Icon-Hälfte berücksichtigen). Wenn `divIcon` mit `iconSize: [0,0]` / auto verwendet wird, ist nichts zu tun.

## Keine Änderungen

- Daten, Modi (hourly/daily), Farben, Typografie, Slider, Popover.
- Andere Marker (SpotMarker) bleiben unangetastet, sofern nicht visuell dieselbe Pill nutzen — falls doch, analog anpassen (kurzer Check während Umsetzung).
