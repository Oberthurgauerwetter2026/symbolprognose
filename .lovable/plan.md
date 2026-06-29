## Plan

### 1) Timeslider im MeteoSchweiz-Stil (Filmstrip)

Statt eines klassischen Range-Sliders mit wanderndem Handle bauen wir einen horizontalen Filmstreifen wie im Video:

- Fixe vertikale Linie in der Mitte = aktuelle Zeit.
- Der Streifen mit Stunden-Labels (01:00, 02:00, …) und kleinen 10-Minuten-Ticks scrollt horizontal, das Handle bleibt stehen.
- Über der Mittellinie schwebt die blaue Zeit-Bubble („Prognose: Montag, 21:40" bzw. „Messung: …").
- Darunter eine zweite Zeile mit dem Tagesnamen („Dienstag, 30.06.2026"), die mitscrollt und Tageswechsel anzeigt.
- Messung- und Prognose-Bereich werden im Streifen farblich unterschieden (z. B. dezent grauer Strich = Messung, blau = Prognose, Hagel/Strichmarker on top).
- Drag/Wisch nach links/rechts scrubt durch die Frames; Play schiebt den Streifen kontinuierlich.
- Links Play/Pause + Pfeil zurück, rechts Pfeil vorwärts (wie im Video). Speed-Buttons bleiben darüber/daneben verfügbar; Hagel-Toggle bleibt erhalten.
- Mobile: gleiche Mechanik mit Touch-Drag, größere Tap-Targets.

Technisch:

- Neue Komponente `FilmstripTimeline` ersetzt `MeteoTimeline` in `radar-map.tsx`.
- Track als virtualisierter Canvas/SVG mit `transform: translateX()` pro RAF, damit Scrubbing und Auto-Play butterweich laufen (kein React-Re-Render pro Frame).
- Der Radar-Frameindex wird aus der aktuellen Slider-Position abgeleitet (snap auf 5-min-Messung bzw. Prognose-Takt). Bei Auto-Play bestimmt der Slider den Frame, nicht umgekehrt.

### 2) NS-Messung gleich rendern wie Prognose

Die Messung läuft heute als CombiPrecip-PNG via `StableImageOverlay`. Die Prognose dagegen läuft als Canvas mit harten Farbbändern (`PrecipOverlay`).

- Messung wird ebenfalls auf den `PrecipOverlay`-Canvas-Pfad umgestellt:
  - PNG der Messung wird einmal pro Frame ausgelesen (Pixelwerte → mm/h via vorhandener Farbtabelle), dann in dasselbe Canvas-Rendering eingespeist wie die Prognose-Felder.
  - Dadurch identische Farbpalette, identische Kantenhärte, identische Skalierung, kein „Pixel-Look" mehr.
- `mch-precip` CSS-Pfad entfällt für die Anzeige (PNG dient nur noch als Datenquelle, nicht als sichtbare Layer).
- Hagel-POH-Overlay bleibt unverändert als eigenständiger Layer.
- kein weichmachen/glätten

### 3) Validierung

- Desktop `/karten/radar`: Filmstrip scrollt smooth beim Scrubben und Auto-Play, Mittellinie bleibt fix, Tageszeile wechselt korrekt.
- Messung → Prognose-Übergang: gleiche Optik der NS-Felder, keine sichtbare Stilkante beim Framewechsel.
- Mobile: Drag funktioniert, keine Performance-Regression.
- Screenshot-Vergleich Messung vs. Prognose: identische Bänder, keine Pixel-Treppen mehr.