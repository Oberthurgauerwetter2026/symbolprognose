# Radar-Karte überarbeiten

Alle Änderungen in `src/components/maps/radar-map.tsx` (plus minimaler Eintrag in `src/data/spots.ts` für die Ortsliste). Keine Backend-Änderungen.

## 1. Standard-Zoom leicht raus
- `BoundsFitter` ersetzt durch festen `center=[47.55, 9.33]`, `zoom=10.5` (statt aktuell `fitBounds(regionBounds)` ≈ Zoom 11.5).
- `maxBounds` weiter, damit der neue Ausschnitt erlaubt ist (ca. ±0.15° um Bbox).
- `minZoom` bleibt 9.

## 2. Hagel standardmässig an
- `useState(showHail)` Startwert auf `true`.
- Button-Beschriftung bleibt; aktiv = lila, inaktiv = grau. Wenn keine Hagel-Daten verfügbar (`!data?.hasHail`), bleibt der Button disabled (kein Auto-Toggle).

## 3. Moderner Zeitslider (MeteoSchweiz-Stil)
Ersetzt den aktuellen `<Slider>` + 3-Zeilen-Label durch eine eigene Timeline-Komponente direkt im File:

```text
[-2h ──── -1h ──── │NOW│ ──── +1h ──── +3h ──── +6h ──── +12h ──── +24h ──── +48h ──── +120h]
                              ▲ Drag-Handle mit aktueller Uhrzeit als Tooltip
```

- Horizontaler Balken, volle Breite, Höhe ~44 px.
- Hintergrund-Segmente:
  - Vergangenheit (`t ≤ now`): heller Blau-Grau (`bg-muted`).
  - Zukunft ICON-CH1 (`now < t ≤ now+33h`): heller Markenblau-Verlauf.
  - Zukunft ICON-CH2 (`> now+33h`): heller Lila-Verlauf.
- Senkrechte Linie für "jetzt" (kontrastfarben, ~2 px, mit kleinem Punkt oben).
- Tick-Labels darüber bei -2h, -1h, JETZT, +3h, +6h, +12h, +24h, +48h, +120h (nur die, die im Frame-Range liegen) — kompakt, tabular-nums.
- Drag-Handle: 14 px Kreis mit Markenfarbe, beim Hover/Active erscheint Bubble mit Datum + Uhrzeit.
- Interaktion: Klick auf Balken springt zu Frame, Drag verschiebt; Tastatur ←/→ ein Frame.
- Play/Pause/Jetzt/Speed-Buttons bleiben oberhalb wie bisher; Hagel-Toggle bleibt rechts.

Technische Umsetzung: kein Radix-Slider, sondern `<div>` + `onPointerDown/Move/Up` mit `getBoundingClientRect()`, weil wir farbige Segmente und freie Tick-Beschriftung brauchen. Index wird über lineare Interpolation aus Pointer-X bestimmt und auf nächsten Frame gerundet.

## 4. Quelle: MeteoSchweiz statt Open-Meteo
- `sourceLabel()` und der Fussnoten-Text: alle "Open-Meteo …" → "MeteoSchweiz". Konkret:
  - `"Messung (Open-Meteo Nowcast)"` → `"Messung MeteoSchweiz"`.
  - Footer ohne `hasRealRadar`-Verzweigung: `"Quellen: MeteoSchweiz Radar (Messung) · MeteoSchweiz ICON-CH1 (Nowcast bis +33 h) · MeteoSchweiz ICON-CH2 (+33 h … +120 h)"`.
- `TileLayer attribution` von `…Open-Meteo · ICON-CH1/CH2` → `© swisstopo · MeteoSchweiz`.
- Backend / Modell-Namen werden NICHT umbenannt (intern bleibt es Open-Meteo-API), nur die UI-Texte.

## 5. Umrisse entfernen
Diese zwei `<GeoJSON>`-Blöcke werden entfernt:
- `data={THURGAU}` (blaue Thurgau-Grenze).
- `data={REGION}` (Markenfarbe-Region-Umriss).

Behalten: `OUTSIDE_CH_MASK`, `SWITZERLAND` (weisser CH-Umriss), `OUTSIDE_MASK` (sanfter Aussen-Schatten), `LAKE`. Damit bleiben Bodensee, CH-Grenze und die generelle Kartenfarbe erhalten.

## 6. Orte hinzufügen
In `src/data/spots.ts`: neue konstante Liste (NICHT die bestehende `SPOTS` ändern, um andere Seiten nicht zu brechen) — oder direkt im `radar-map.tsx` als lokales Array, da nur dort benötigt:

```ts
const RADAR_CITIES = [
  { name: "Amriswil",       lat: 47.5469, lon: 9.2986 },
  { name: "Erlen",          lat: 47.5375, lon: 9.2378 },
  { name: "Bischofszell",   lat: 47.4944, lon: 9.2389 },
  { name: "Münsterlingen",  lat: 47.6306, lon: 9.2378 },
  { name: "Romanshorn",     lat: 47.5664, lon: 9.3789 },
  { name: "Egnach",         lat: 47.5444, lon: 9.3833 },
  { name: "Horn",           lat: 47.4986, lon: 9.4470 },
];
```

Rendering analog zum Screenshot: kleiner weisser Hohlkreis (4 px Radius, dunkler Rand) + Label rechts daneben in dunklem Sans-Serif. Umsetzung als `L.divIcon` pro Stadt + `L.marker(..., { interactive: false, keyboard: false })`. Labels liegen über allen Overlays (`zIndexOffset` hoch + eigene CSS-Klasse mit `pointer-events:none`, weisser Text-Schatten für Lesbarkeit auf Niederschlag).

```text
○ Amriswil
```

CSS (inline `<style>` oder Tailwind-Klassen):
- Punkt: 8 px Kreis, `background:#fff`, `border:1.5px solid #1a1a1a`.
- Text: 12 px, `font-weight:500`, Farbe `#1a1a1a`, leichter weisser Halo (`text-shadow: 0 0 2px #fff, 0 0 2px #fff`).

## Out of Scope
- Backend / `radar.functions.ts` / Cache bleiben unverändert.
- Andere Karten (Wind, Pollen, …) bleiben unverändert.
- Keine neuen npm-Packages.

## Verification
Nach Build: `/karten/radar` öffnen und prüfen:
1. Karte zeigt etwas mehr Umland als bisher.
2. Hagel-Toggle ist beim Laden aktiv (sofern `hasHail`).
3. Slider zeigt farbige Bereiche + "jetzt"-Linie + Tick-Labels; Drag funktioniert flüssig.
4. Quelle-Badge und Footer nennen nur noch MeteoSchweiz.
5. Keine blauen Region-/Thurgau-Linien mehr sichtbar; Bodensee + CH-Grenze noch da.
6. 7 Ortsmarker mit Punkt + Label sichtbar, lesbar auf Regen-Overlay.
