# Regionskarte: alle Warnsymbole pro Ort anzeigen

## Ausgangslage

In der Symbolprognose-Regionskarte zeigt jeder Ort (Horn, Amriswil, Sitterdorf, Münsterlingen) aktuell nur **eine** Warnung an: `topWarningFor` liefert nur die wichtigste Warnung der Gemeinde, und die Marker-Pille zeigt genau ein Symbol-Badge oben rechts. Weitere gleichzeitig aktive Warnungen (z. B. Regen + Wind) sind auf der Karte nicht sichtbar.

## Ziel

Pro Ort werden **sämtliche aktiven Warnungen** (inkl. Vorinformationen) als Symbol-Badges am Marker angezeigt — jedes Gefahrensymbol mit seiner Stufenfarbe, sortiert nach Stufe (höchste zuerst).

## Umsetzung

- `spotWarnings` liefert neu pro Ort eine **Liste** aller Warnungen der Gemeinde (`warningsForRegion` statt `topWarningFor`), bereits nach Stufe sortiert.
- Die Marker-Pille rendert statt eines Badges eine **Reihe von Badges** oben rechts am Pillenrand (kleine Überlappung/Staffelung, damit mehrere Symbole kompakt bleiben). Jede Warnung: Gefahrensymbol in Stufenfarbe; Vorinformationen mit Schraffur-Hintergrund wie auf der Warnkarte.
- Pro Gefahr maximal ein Badge (höchste Stufe dieser Gefahr), damit bei doppelten Warnungen derselben Gefahr keine Duplikate entstehen.
- Klick-Verhalten bleibt: Marker mit mindestens einer Warnung öffnet die Warnseite; Rahmenfarbe der Pille folgt weiterhin der höchsten Stufe.
- Das Banner am oberen Kartenrand und die maximale Stufenlogik bleiben unverändert.

## Technische Details

- Datei: `src/components/region-map.tsx`
  - `spotWarnings`: Typ `Record<string, WarningDTO[]>`; Dedup pro `hazard` (höchste Stufe behalten), Sortierung nach `level` absteigend.
  - `SpotMarker`/`MarkerPill`: Prop `warning` → `warnings: WarningDTO[]`; Badge-Rendering als gestaffelte Gruppe (flex row, negativer Overlap), weiterhin `renderToStaticMarkup` für das Leaflet-divIcon.
  - Vorinformation: Hintergrund des Badges mit Schraffur (CSS `repeating-linear-gradient` in Stufenfarbe), passend zum bestehenden Schraffur-Stil.
- Keine Änderung an `warnings-lookup.ts`, Banner oder anderen Karten.
