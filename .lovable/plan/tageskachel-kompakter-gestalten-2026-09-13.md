# Tageskachel kompakter gestalten

Die Tageskacheln in der Lokalprognose/Regionskarte nehmen aktuell viel Platz ein (grosse Icons, grosse Schrift, viel Padding). Ziel ist eine kompaktere Darstellung mit gleichem Informationsgehalt.

## Was geändert wird

- **Padding reduzieren:** Innenabstand der Kachel von `p-2`/`@[640px]:p-4` auf einheitlich kleineres Padding (z. B. `p-2`) senken.
- **Icon verkleinern:** `WeatherIcon size={80}` und die responsiven SVG-Overrides `h-14`/`h-20` auf ca. `size={56}` bzw. `h-10`/`h-12` reduzieren.
- **Temperaturen kleiner:** Max-Temperatur von `text-lg`/`text-xl`/`text-2xl` auf `text-base`/`text-lg` zurücknehmen; Min-Temperatur auf `text-sm`/`text-base`.
- **Vertikale Abstände verkleinern:** `space-y-2`/`space-y-3` innerhalb der Kachel auf `space-y-1`/`space-y-1.5` reduzieren.
- **Sparkline flacher:** `DayRainSparkline` Höhe von `h-8` auf `h-5` oder `h-6` reduzieren, damit die untere Regenzeile weniger Raum braucht.
- **Niederschlagszeile kompakter:** Abstand zwischen mm-Angabe und Prozent kleiner halten; ggf. Schriftgrösse von `text-sm` auf `text-xs`.

## Was bleibt gleich

- Alle bestehenden Informationen (Wochentag, Datum, Icon, Min/Max-Temperatur, Niederschlagssumme, Regenwahrscheinlichkeit, Sparkline) bleiben sichtbar.
- Interaktionen (Tippen öffnet volle Prognose, Hover, Auswahl-Markierung) bleiben erhalten.
- Keine Änderung an der Datenlogik oder an anderen Komponenten.

## Validierung

- Typecheck und Build prüfen.
- Visuell in der Vorschau auf Mobile (kleinste Breite) und Desktop prüfen, dass die Kachelreihe ohne Überlappungen lesbar bleibt und weniger vertikalen Raum einnimmt.
