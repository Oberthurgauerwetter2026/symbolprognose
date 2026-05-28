# Blitze auf der Radar-Karte

## Ausgangslage (geprüft)

- Der MeteoSchweiz-Open-Data-Katalog enthält **keine** Blitzdaten. Verfügbar sind nur Niederschlag (CPC), Hagel (POH) und Klima-/Hagel-Klimaprodukte. Die MeteoSchweiz-Blitze stammen aus einem kommerziellen, lizenzpflichtigen Netz und sind nicht offen.
- Für nicht-kommerzielle Nutzung mit echtem Karten-Overlay bleibt das **Blitzortung.org / LightningMaps**-Community-Netz. Dessen Lizenz erlaubt private/nicht-kommerzielle Nutzung mit **Quellenangabe (Pflicht)**.

## Was gebaut wird

Ein optionaler, ein-/ausschaltbarer **Blitz-Layer** über dem bestehenden Niederschlags-Radar (nur „Messung"-Zeitfenster, kein Forecast). Blitze der letzten ~30–60 Minuten werden als Punkte/Marker auf der Leaflet-Karte gezeichnet, ältere blassen aus.

```text
[Radar-Karte]
 ├─ Niederschlag (Canvas)      ← bestehend
 ├─ Hagel POH (ImageOverlay)   ← bestehend
 └─ Blitze (neuer Marker-Layer) ← NEU, Toggle
      Quelle: Blitzortung-Echtzeit (WebSocket), nur Bbox Oberthurgau
```

### Datenfluss

- Client-seitig (nur bei aktivem Layer): Verbindung zum öffentlichen Blitzortung-Echtzeit-WebSocket. Eingehende Einschläge werden nach Zeit (< 60 min) und auf die Karten-Bbox gefiltert.
- Jeder Einschlag = kleiner Kreis-Marker; Deckkraft sinkt mit Alter (frisch = hell/gelb, alt = blass). Optional kurzes Aufblitzen für neue Einschläge.
- Verbindung wird getrennt, sobald der Layer aus ist oder die Karte verlassen wird (keine Dauerlast).

### UI

- Neuer Layer-Toggle „Blitze" in der bestehenden Karten-Steuerung (analog zum Hagel-Toggle).
- Kleiner Pflicht-Hinweis „Blitzdaten: Blitzortung.org" als Quellenangabe in der Legende/Ecke.
- Hinweis, dass es sich um ein Community-Netz handelt (nicht MeteoSchweiz, nicht garantiert vollständig).

## Nicht enthalten / Grenzen

- Kein historischer Blitz-Zeitverlauf entlang der Timeline (nur Live/letzte Minuten), da das Netz keine einfache Verlaufs-API bietet.
- Kein Blitz im JS-freien `<noscript>`-Fallback (Echtzeit-Feed benötigt JavaScript).
- Rein nicht-kommerzielle Nutzung; bei späterer kommerzieller Nutzung müsste auf eine lizenzierte Quelle (z. B. Météorage) gewechselt werden.

## Technische Details

- Neue Komponente `LightningLayer` in `src/components/maps/` (Leaflet-Layer wie `PrecipOverlay`), eingebunden in `radar-map.tsx` hinter einem State-Toggle.
- WebSocket-Anbindung + Entkodierung der Blitzortung-Nachrichten in einem kleinen Client-Hook (`src/hooks/use-lightning.ts`), mit Bbox-/Zeitfilter und automatischem Reconnect/Cleanup.
- Marker als leichte `L.circleMarker`/Canvas-Punkte, damit auch viele Einschläge performant bleiben.
- Quellenangabe als Pflichtbestandteil fest in der Legende.

## Offene Bestätigung

Falls dir die ToS-Grauzone des Community-Feeds nicht behagt, ist die 100 % saubere Alternative das **offizielle LightningMaps-Embed-Widget** als separate Karte (kein Overlay) – das kann ich stattdessen einbauen.
