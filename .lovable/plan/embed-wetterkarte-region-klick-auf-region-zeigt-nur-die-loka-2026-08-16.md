# Embed „Wetterkarte Region“: Klick auf Region zeigt nur die Lokalprognose

## Problem

Im Embed `/embed/region` führt ein Klick auf eine Gemeinde (und die Auswahl über die Ortssuche) per `router.navigate` auf `/karten/lokal`. Das ist die volle Wetterboard-Seite mit Sidebar, Kopfzeile und Kartenreitern — im iframe unpassend.

## Ziel

Im Embed bleibt alles im iframe: Nach dem Klick auf eine Region wird die Karte durch die reine Lokalprognose des gewählten Orts ersetzt — ohne Wetterboard-Rahmen, ohne Kartenreiter. Ein schlanker „Zurück zur Karte“-Button führt wieder zur Regionskarte.

## Umsetzung

1. `src/components/region-map.tsx`
   - Optionale Prop `onSelectSpot?: (spot: { name: string; lat: number; lon: number }) => void`.
   - `goToLokal()` ruft, falls gesetzt, nur diesen Callback auf (kein `router.navigate`, kein `window.location.assign`). Standardverhalten auf `/karten/region` bleibt unverändert.
   - Gleiche Behandlung für die Ortsauswahl in der Suchleiste (`MapSearchBar`), damit auch die Suche im Embed nicht wegnavigiert.

2. `src/routes/embed.region.tsx`
   - Lokaler State `selected` (Ort oder `null`).
   - `null` → `RegionMap` mit `onSelectSpot={setSelected}`.
   - Ort gewählt → `WeatherWidget` mit `detailOnly compact lockedLocation={…}` plus kleine Kopfzeile mit Ortsname und „Zurück zur Karte“-Button (setzt State zurück).
   - Bleibt in `EmbedShell`, damit die Höhe wie bisher an die einbettende Seite gemeldet wird.

3. `src/routes/embed-info.tsx`
   - Beschreibung des Produkts „Wetterkarte Region“ um den Hinweis ergänzen, dass ein Klick auf eine Gemeinde die Lokalprognose im gleichen Widget öffnet.
   - Für dieses Produkt die Auto-Höhen-Variante des Snippets nutzen, da die Prognose höher ist als die Karte.

## Hinweise

Die Standard-Seiten (`/karten/region`, Warnkarte) verhalten sich unverändert; die Änderung greift nur, wenn `onSelectSpot` übergeben wird.
