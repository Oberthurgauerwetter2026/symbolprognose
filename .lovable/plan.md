## Ortsbeschriftungen auf `/intern/niederschlag`

In `src/components/maps/precip-accum-map.tsx` sieben Ortspunkte mit Labels einblenden: Bischofszell, Romanshorn, Amriswil, Horn, Erlen, Münsterlingen, Güttingen.

### Umsetzung

- Import erweitern: `CircleMarker, Tooltip` aus `react-leaflet`.
- Konstante `CITIES: { name, lat, lon }[]` mit den 7 Orten (Koordinaten aus bekannten Werten, z. B. Amriswil 47.5469/9.2986).
- Nach dem THURGAU-`GeoJSON` (Zeile 422), vor `ZoomControl`, eine Liste rendern:
  - `CircleMarker` (radius 3, weiß gefüllt, dunkler Rand, `interactive={false}`)
  - dazu permanentes `Tooltip` (`permanent direction="right" offset={[6,0]}`) mit Ortsname, eigene CSS-Klasse für kleines, kompaktes Label (weißer Halbtransparenz-Hintergrund, dunkler Text, kein Pfeil).
- Tooltip-Styling via kleine `<style>`-Injektion oder Klasse in `src/styles.css` (kurz, lokal in der Komponente reicht).

### Verifikation

- `/intern/niederschlag`: sieben Ortspunkte mit Namen sichtbar, auch bei Zoom-Änderungen lesbar.
- PNG-Download enthält die Marker und Labels (liegen im Map-Container, werden vom html-to-image-Filter nicht ausgeschlossen).
