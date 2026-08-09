# Satellitenbild: fehlende Bilder und lange Ladezeiten beheben

## Befund (am Dienst geprüft, 08:30 UTC)

1. **Die verwendeten Layer existieren beim Dienst nicht mehr.** Ein Testaufruf mit
   `mtg_hrfi:rgb_geocolour` (Schweiz & Alpen und Europa Geo) bzw. `mtg_hrfi:ir105`
   (Europa IR) antwortet mit `LayerNotDefined – Could not find layer`.
   Die Layer-Liste des Dienstes enthält den ganzen `mtg_hrfi:`-Namensraum nicht mehr;
   verfügbar sind nur noch `mtg_fd:rgb_geocolour` und `mtg_fd:ir105_hrfi` —
   genau die, die im Code bisher nur als Reserve hinterlegt sind.
   Deshalb bleibt die Karte leer und der Zähler auf `0/18`: jedes einzelne Kachelbild
   scheitert, bis die Reserve-Umschaltung greift — und die lädt danach alle
   18 Zeitschritte komplett neu.

2. **Zu viele gleichzeitige Bildanfragen.** Alle 18 Zeitschritte werden innerhalb
   von ~1,5 Sekunden gleichzeitig angehängt. Jeder Zeitschritt lädt mehrere Kacheln,
   und jede Kachel wird in doppelter Auflösung (1024 px) angefordert. Das sind rund
   100 parallele Anfragen an denselben Server, während der Browser nur 6 gleichzeitig
   zulässt. Gemessene Antwortzeiten: 0,15–1,1 s pro Kachel beim GeoColour-Layer und
   bis zu 8,9 s beim Infrarot-Layer. In der Summe ergibt das die lange Wartezeit.

3. **Fortschritt und Start passen nicht zusammen.** Die Animation startet, sobald ein
   einziger Zeitschritt fertig ist; die übrigen sind dann noch nicht da, wodurch
   während des Abspielens leere Bilder erscheinen.

## Änderungen

1. **Layer-Namen korrigieren**: `mtg_fd:rgb_geocolour` (Schweiz & Alpen, Europa Geo)
   und `mtg_fd:ir105_hrfi` (Europa IR) als Hauptquelle; die alten `mtg_hrfi:`-Namen
   entfallen. Damit werden Bilder sofort geladen, ohne Reserve-Umschaltung und ohne
   den kompletten Neuaufbau danach.
2. **Geordnetes Nachladen statt Ansturm**: Zeitschritte werden in einer Warteschlange
   geladen — höchstens 3 gleichzeitig, beginnend beim angezeigten Bild und dann
   abwechselnd nach hinten und vorne. Der nächste Zeitschritt startet erst, wenn ein
   vorheriger fertig ist.
3. **Kachelgrösse dem Bildschirm anpassen**: die doppelte Auflösung wird nur noch auf
   hochauflösenden Bildschirmen angefordert. Auf normalen Bildschirmen halbiert das
   die Datenmenge ohne sichtbaren Qualitätsverlust.
4. **Sauberer Start der Animation**: Das Abspielen beginnt erst, wenn mindestens
   ein Drittel der Zeitschritte bereit ist; vorher zeigt der Zähler wie bisher den
   Fortschritt. Beim Abspielen werden nur bereits geladene Zeitschritte
   angesprungen, sodass keine leeren Bilder mehr erscheinen.
5. **Infrarot entlasten**: Für den erkennbar langsamen Infrarot-Layer wird die Anzahl
   Zeitschritte von 12 auf 8 reduziert (3 h Zeitraum bleibt, gröberer 20-Minuten-Takt).

## Technische Details

- `src/lib/satellite.functions.ts`: `layer`/`fallbackLayer` je Region auf die real
  vorhandenen `mtg_fd:`-Layer umstellen; `stepMinutes` für `europa-ir` auf 20.
- `src/components/maps/satellite-map.tsx`:
  - `HiDpiWMS`: Supersampling nur bei `devicePixelRatio > 1`.
  - `FrameStack`: Timer-Kaskade (`80 + k*40 ms`) durch eine Warteschlange mit
    `MAX_IN_FLIGHT = 3` ersetzen; Fertigmeldung („load"/„tileerror") gibt den
    nächsten Platz frei. Geladene Indizes weiterhin über `loadedRef` zählen und
    per `onProgress` melden, zusätzlich als Set nach oben geben.
  - Autoplay-Bedingung und `setInterval`-Fortschaltung nutzen die Menge der
    geladenen Indizes.
- Reserve-Umschaltung bleibt als Schutz erhalten, sollte der Dienst erneut
  Layer umbenennen.
