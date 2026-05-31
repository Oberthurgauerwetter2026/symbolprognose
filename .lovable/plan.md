## Plan

1. **PNG-Download wirklich robust machen**
  - Den Export von `a.click()`/Blob-Fallback auf eine zuverlässigere Strategie umstellen: zuerst direkt als `data:image/png` in einem neuen Tab öffnen, zusätzlich im Tab einen sichtbaren „PNG speichern“-Link anzeigen.
  - Danach optional weiterhin den automatischen Download per Link versuchen, aber nicht mehr als einzige Erfolgsmethode behandeln.
  - Den Export in eine eigene Funktion kapseln, damit Canvas-Erzeugung, Dateiname und Fallback klar getrennt sind.
2. **Kartenblick stärker aus der Vogelperspektive**
  - Den Kartenausschnitt enger auf Oberthurgau/Lake-Constance-Umfeld zuschneiden und die nutzbare Kartenfläche vergrößern.
  - Header/Legende etwas kompakter halten, damit die Karte selbst dominanter wirkt.
  - Die topografische/administrative Ebene klarer zeichnen: hellere Grundkarte, kräftigere Thurgau-Kontur, Lake-Constance-Fläche klar abgesetzt.
3. **Farbverlauf markanter statt weich/verwaschen**
  - Den Blur entfernen.
  - Von weicher linearer Interpolation auf deutlicher abgestufte Niederschlagsklassen wechseln, ähnlich Radar-Prognose-Farbstufen.
  - Höhere Deckkraft und kontrastreichere Farben verwenden, damit 1/2/5/10/20/50 mm klar unterscheidbar sind.
  - Legende von kontinuierlichem Verlauf auf einzelne Farbbänder umstellen, passend zu den sichtbaren Klassen.
4. **UI nur gezielt anpassen**
  - Die bestehende interne Route und Datenquelle unverändert lassen.
  - Nur `src/components/maps/precip-accum-map.tsx` anfassen; Auth, Query und Routing bleiben gleich.

## Technische Details

- `colorForAccumSmooth()` wird durch eine klassierte Farbzuordnung ersetzt.
- `renderMap()` rendert die Heatmap ohne `ctx.filter = blur(...)` und mit stärkerer Alpha.
- `download()` erzeugt weiterhin ein separates Export-Canvas in 1× Größe, öffnet aber zusätzlich ein neues Dokument mit dem PNG und Speicherlink, damit es auch in der Preview-Sandbox funktioniert.