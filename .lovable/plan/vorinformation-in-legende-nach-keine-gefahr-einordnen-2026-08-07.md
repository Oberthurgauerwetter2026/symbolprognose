# Vorinformation in Legende nach „Keine Gefahr" einordnen

## Ziel
Die Warnkarten-Legende soll die Vorinformation nicht mehr als letzten Eintrag nach den Stufen 1–3 anzeigen, sondern direkt nach „Keine Gefahr" und vor „Stufe 1" einordnen.

## Aktueller Zustand
In `src/components/maps/warn-map.tsx` werden die Legenden-Einträge in zwei Stellen gerendert:

- Eingeklappte Karten-Legende (Overlay unten links, ca. Zeile 600)
- Info-Panel auf der rechten Seite (ca. Zeile 686)

Aktuelle Reihenfolge in beiden:
1. Keine Gefahr
2. Stufe 1
3. Stufe 2
4. Stufe 3
5. Vorinformation

## Geplante Änderung
Reihenfolge in beiden Legenden anpassen auf:
1. Keine Gefahr
2. Vorinformation
3. Stufe 1
4. Stufe 2
5. Stufe 3

Das Schraffur-Muster der Vorinformation bleibt unverändert erhalten.

## Technische Umsetzung
- In `src/components/maps/warn-map.tsx` die beiden Legend-Arrays (`[0, 1, 2, 3]` plus separater Vorinformation-Block) zu einem durchgängigen Array mit der neuen Reihenfolge zusammenführen.
- Keine Änderung an Datenmodell, Warnlogik oder Admin-Tool; reine Darstellungsanpassung.

## Validierung
- Production-Build erfolgreich durchlaufen lassen.
- TypeScript-Typecheck prüfen.
- Screenshot der Warnkarte (Desktop + Mobile) zur visuellen Kontrolle der neuen Legenden-Reihenfolge.