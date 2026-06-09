## Ziel
Statisches Lokalprognose-Embed (`/api/public/embed/region-lokal-static`) so umbauen, dass:
- Wettersymbole statt nur Text dargestellt werden
- „Aktuell"-Block kompakt wird
- „Nächste Stunden" mehr Platz erhält
- Gesamthöhe so knapp ist, dass das Embed neben der TWINT-Spalte komplett sichtbar bleibt (keine Scrollleiste/kein Abschnitt unter TWINT)

## Umsetzung

1. **Inline-SVG-Symbole im Static-Endpoint**
   - In `src/routes/api/public/embed/region-lokal-static.ts` eine kleine Map `codeToSymbol(code)` ergänzen, die für jeden Open-Meteo Weathercode ein passendes Inline-SVG (Sonne, Sonne+Wolke, Wolke, Nebel, Regen, Schauer, Schnee, Gewitter) zurückgibt.
   - Symbole als reines SVG (kein externer Request, kein JS) in der Grösse ~22 px für die Tabelle und ~40 px für „Aktuell" einbinden, Farben fix (gelb/grau/blau) damit auf jedem Monitor konsistent.

2. **Kompakter „Aktuell"-Block**
   - Aus eigener Card eine schmale Zeile machen: links Symbol (40 px) + Temperatur gross, rechts kleiner Text „Bewölkt · 0.0 mm/h · 7 km/h NW · 14:00".
   - Padding und Schriftgrössen reduzieren; keine zweispaltige `dl` mehr.

3. **„Nächste Stunden" prominenter**
   - Mehr Zeilen zeigen (12 → 12 behalten, aber kompakter pro Zeile, damit alle sichtbar sind ohne Scroll).
   - Spalten: Zeit · Symbol · Temp · Regen · Wind. Spalte „Wetter"-Text entfällt (Symbol ersetzt Text), spart Breite und Höhe.
   - Zeilenhöhe reduziert (padding 4–5 px), Schrift 12–13 px.

4. **7-Tage-Übersicht straffen**
   - Symbol statt Text, kompaktere Zeilen, Wochentag-Kürzel + Datum kürzer.
   - Optional auf 5 Tage reduzieren, falls Höhe knapp wird.

5. **Gesamthöhe / Snippet**
   - Höhe so wählen, dass es zur TWINT-Spalte passt. Aus dem Screenshot ist die rechte Spalte ca. 640–680 px hoch. Ziel: Embed-Inhalt rendert in ≤ 640 px ohne innere Scrollbar.
   - In `src/routes/embed-info.tsx` Snippet-`height` von `760` auf `640` reduzieren und `scrolling="no"` setzen, damit nichts mehr abgeschnitten/gescrollt wird.
   - CSS im Static-Endpoint: `body { min-height: 0 }`, kompaktere Paddings, kein `min-width:520px` auf der Tabelle (damit nichts horizontal scrollt im schmalen Container).

6. **Keine Funktionsänderung sonst**
   - Datenquelle, Caching-Header und die interaktive Route `/embed/region-lokal` bleiben unverändert.

## Verifikation
- HTML der statischen Route abrufen und prüfen: Symbole vorhanden, Layout kompakt, keine Tabelle > 640 px.
- Snippet auf `/embed-info` zeigt neue Höhe `640` und `scrolling="no"`.
