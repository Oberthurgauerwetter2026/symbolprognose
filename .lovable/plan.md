# Warnkarte kompakter auf dem Smartphone

Auf dem Handy ist die Karte aktuell 560 px hoch. Der Warntext im Panel darunter liegt damit fast komplett unterhalb des Bildschirms — man muss viel scrollen, um Karte und Text zusammen zu sehen.

## Änderung (nur mobile Darstellung)

In `src/components/maps/warn-map.tsx`:

1. Kartenhöhe auf schmalen Bildschirmen von 560 px auf ca. 340 px reduzieren (`h-[340px]`), ab Tablet/Desktop bleibt alles wie heute (600 px). Die Karte bleibt vollständig sichtbar, nur weniger hoch.
2. Info-/Warntext-Panel auf dem Handy nicht mehr unbegrenzt wachsen lassen: Warnliste bekommt mobil eine Maximalhöhe (ca. 300 px) mit eigenem Scrollbereich. So sind Karte plus Warntext gemeinsam auf einem Handy-Bildschirm sichtbar; längere Listen scrollen intern statt die Seite zu verlängern.
3. Der Gefahren-Banner oben bleibt unverändert (bereits horizontal scrollbar).

Desktop, Tablet, Embeds im `bare`-Modus und die Widget-Snapshots behalten ihre bisherigen Höhen. Reine Layout-Änderung, keine Datenlogik.

## Prüfung

Warnkarte im Handy-Hochformat (z. B. 390×844) öffnen: Karte und erster Warntext ohne Scrollen sichtbar; Warnliste scrollt innerhalb des Panels. Desktop-Ansicht unverändert 600 px.
