# Wetterkarte Region: Klick auf Region/Marker deaktivieren

## Ziel

Ein Klick oder Tipp auf eine Gemeinde bzw. deren Symbol in der Wetterkarte Region öffnet keine Lokalprognose mehr — überall (Seite `/karten/region`, Embeds und Widgets). Die Ortssuche oben in der Karte bleibt unverändert: Ein dort gewählter Ort führt weiterhin zur Lokalprognose (bzw. im Embed zur eingebetteten Prognose).

## Umsetzung

1. `src/components/region-map.tsx`
   - Der Marker erhält keine Klick-Aktion mehr: `onClick` wird bei `SpotMarker` nicht mehr übergeben.
   - Die Funktion `goToLokal` und die dafür genutzte Router-Navigation entfallen, soweit sie nur noch vom Marker verwendet wurden.
   - Die Ortssuche (`LocationSearch`) behält ihr Verhalten inklusive `onSelectSpot` im Embed.

2. `src/components/region-map-template.tsx` (bzw. die Marker-Komponente `SpotMarker`)
   - `onClick` wird optional; ohne Handler kein Klick-Cursor, kein Hover-/Pressed-Zustand und keine Tastatur-/ARIA-Button-Rolle, damit das Symbol als reine Anzeige erkennbar ist.

3. `src/routes/embed.region.tsx`
   - Bleibt unverändert; der lokale `selected`-Zustand wird jetzt nur noch über die Ortssuche gesetzt.

## Hinweise

Die Lokalprognose bleibt über die Ortssuche und die normale Navigation (Reiter „Lokal“) erreichbar. Warn-Banner und Verlinkung zur Warnkarte bleiben klickbar.
