## Anpassungen in `src/components/weather-widget.tsx`

### 1. Cursor auf den Tooltip-Flächen
Die grauen Säulen der `DayRainSparkline` und die schmalen Säulen in der stündlichen Detailansicht haben aktuell `cursor-help` (Fragezeichen-Cursor). Das wirkt wie ein Hinweis auf eine Erklärung statt auf einen Wert.

- `cursor-help` entfernen (Zeile 645 und Zeile 1124).
- Standard-Cursor (Pfeil) bleibt; Tooltip funktioniert weiterhin per Hover/Tap.

### 2. Regen-Symbol: Wolke → blauer Tropfen
Aktuell wird `CloudRain` (Wolke mit Regen) aus `lucide-react` verwendet — an drei Stellen:
- Zeile 704 (Tageskarte, Niederschlagszeile)
- Zeile 921 (Überschrift „mm/3h" in der Detailansicht)
- Zeile 1304 (Legende)

Ersatz: `Droplet` aus `lucide-react`, eingefärbt mit der bestehenden Regen-Farbe `text-[var(--wx-rain)]` (statt `text-zinc-700`), damit das Symbol konsistent mit den Balken in derselben Farbe erscheint.
`CloudRain` aus dem Import in Zeile 20 entfernen, `Droplet` ergänzen.

### 3. Wind-Symbol: Pfeil-Wind → Windsack
Aktuell wird `Wind` (drei wehende Linien) aus `lucide-react` an zwei Stellen verwendet:
- Zeile 714 (Tageskarte, Windzeile)
- Zeile 1305 (Legende)

`lucide-react` hat keinen Windsack. Daher: kleine eigene Inline-SVG-Komponente `WindsockIcon` direkt in `weather-widget.tsx` definieren (~20 Zeilen). Stilistisch zu Lucide passend:
- `currentColor`, `strokeWidth=2`, abgerundete Linien
- Mast links (vertikale Linie), oben Ring, daraus konische Form mit 2–3 Streifen nach rechts auslaufend
- Größe per `className="w-4 h-4"` steuerbar
- Gleiche Farbe wie bisher (`text-zinc-700` bzw. Legende-Standard)

`Wind` aus Lucide an beiden Stellen durch `WindsockIcon` ersetzen. Den `Wind`-Import in Zeile 20 entfernen, wenn er sonst nirgends mehr benutzt wird.

### Nicht betroffen
- Daten, Tooltip-Inhalte, Layout, Farben der Balken, Pfeil-Komponente `WindArrow` (Windrichtung) bleiben unverändert.
- Server-Rendering (`weather-icon-svg.server.ts`) wird nicht angefasst — die Änderung betrifft nur die UI-Begleitsymbole im Widget.
