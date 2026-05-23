Ich passe die Region-Karte gezielt für Smartphone-Breiten an, damit keine rechte Seite mehr abgeschnitten wird und die Wochentage sauber erreichbar bleiben.

Plan:
1. **Layout-Overflow entfernen**
   - In `DashboardLayout` und der Region-Seite die flex/min-width-Struktur so korrigieren, dass der Hauptbereich auf Mobile nicht breiter als der Viewport wird.
   - Die Seiten-Paddings auf kleinen Displays reduzieren, damit die Karte die verfügbare Breite nutzt statt horizontalen Seiten-Overflow zu erzeugen.

2. **Karte wirklich komplett einpassen**
   - In `src/components/region-map.tsx` statt fester Leaflet-Zentrierung/Zoom einen berechneten `regionBounds` verwenden.
   - Die Bounds um Marker-Pill-Breite/Höhe optisch puffern, sodass auch rechts liegende Orte wie Uttwil/Egnach inklusive Pill vollständig sichtbar sind.
   - Auf Resize/Rotation `invalidateSize()` und `fitBounds()` erneut ausführen.
   - `minZoom` auf kleinen Screens lockern, damit Leaflet weit genug herauszoomen darf.

3. **Marker-Pills auf Mobile kompakter machen**
   - Die Pill-Größen/Icon-Anker abhängig von der Viewport-Breite verkleinern, damit sie nicht aus dem sichtbaren Kartenbereich ragen.
   - Die Karte bleibt weiterhin klickbar und leitet wie gewünscht zur Lokalprognose weiter.

4. **Wochentage sichtbar/bedienbar halten**
   - Die DayTabs unter der Karte so anpassen, dass sie auf Mobile nicht den Gesamtseiten-Overflow verursachen.
   - Aktiver Tag bleibt sichtbar; horizontales Scrollen innerhalb der Tab-Leiste bleibt möglich, ohne dass die ganze Seite seitlich scrollt.

5. **Mobile-Check**
   - Danach auf Smartphone-Breite prüfen, dass Karte, rechte Marker und Wochentage ohne abgeschnittene rechte Seite angezeigt werden.