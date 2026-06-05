## Ziel

Die Niederschlagssummen-Karte (`/intern/niederschlag`) soll dieselbe Orte-Logik wie die Radarkarte verwenden: **nur Oberthurgau**, gestaffelt nach Zoom (Hauptorte ab 10.5, mittlere ab 11.5, kleine ab 12.5).

## Aktuelles Verhalten

`src/components/maps/precip-accum-map.tsx` Z. 27–60: 26 Einträge, darunter Orte ausserhalb Oberthurgau (Kreuzlingen, Weinfelden, Sulgen, Bürglen, Hohentannen, Altnau, Lengwil, Bottighofen, Tägerwilen, Berg) und Zoom-Stufen 10/11 statt 10.5/11.5/12.5.

## Änderung

In `src/components/maps/precip-accum-map.tsx`:

1. **`CITIES`-Liste ersetzen** durch dieselbe Liste wie in `radar-map.tsx` (21 Orte), mit identischen Tiers:
   - Tier A (ohne `minZoom` → Default-Gate 10.5): Amriswil, Romanshorn, Arbon, Horn, Münsterlingen, Egnach, Güttingen
   - Tier B (`minZoom: 11.5`): Roggwil, Uttwil, Salmsach, Sommeri, Erlen, Langrickenbach
   - Tier C (`minZoom: 12.5`): Hefenhofen, Dozwil, Kesswil, Hauptwil-Gottshaus, Zihlschlacht-Sitterdorf, Bischofszell

2. **Filterlogik anpassen** (Z. 93): von `z >= (c.minZoom ?? 0)` auf `z >= (c.minZoom ?? 10.5)`, damit Tier A erst ab Zoom 10.5 erscheint — identisch zur Radarkarte.

## Nicht betroffen

- Niederschlagslayer/Datenaggregation, Legende, Slider, Attribution, Marker-Icon.
- Andere Karten.
