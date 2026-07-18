## Problem

Auf dem Screenshot ist im Sat-Widget (loop-Modus) der Westen der Schweiz (Genfersee) angeschnitten, obwohl der Loop-Modus die Schweiz vollständig anzeigen soll. Zusätzlich fehlt ein Datum-/Zeit-Stempel für den aktuell angezeigten Frame.

## Ursache

In `src/components/maps/satellite-map.tsx`, `FlyToRegion`:

```ts
const raw = map.getBoundsZoom(bounds, true, L.point(12, 12));
```

Der zweite Parameter `inside=true` liefert laut Leaflet-Doku den **minimalen Zoom, bei dem der Viewport in die Bounds passt** — also das Gegenteil. Für „ganze Schweiz sichtbar" muss `inside=false` (Default) verwendet werden: max. Zoom, bei dem die Bounds komplett in den Viewport passen.

## Änderungen — nur `src/components/maps/satellite-map.tsx`

1. **Bounds-Fit korrigieren**
   - `map.getBoundsZoom(bounds, false, L.point(12, 12))` (statt `true`).
   - Zusätzlich `map.fitBounds(bounds, { padding: [12, 12], animate: false })` verwenden, damit auch der Center passt (aktuell wird `CH_CENTER` statisch gesetzt — bei sehr breiten Widget-Containern kann das leicht mittig zu weit östlich wirken).
   - `minZoom`/`maxZoom` weiterhin auf den ermittelten Integer-Zoom fixieren, damit der Layer scharf bleibt.

2. **Datum/Zeit-Overlay im Loop-Widget**
   - Neues kleines Chip oben rechts (`absolute right-3 top-3`), semantische Tokens (`bg-card/85`, `text-foreground`, `border`, `backdrop-blur-sm`).
   - Zeigt `frames[safeIndex].time` als `DD.MM. HH:mm` in Europe/Zurich-Zeitzone.
   - Nur rendern, wenn `loop && frames.length > 0`.
   - Positionierung so, dass sie mit dem bestehenden „Keine Blitze"-Chip (oben links) nicht kollidiert.

## Nicht in diesem Plan

- Keine Änderungen am Nicht-Loop-Modus (dort ist Filmstrip mit Zeitanzeige vorhanden).
- Keine Änderung an Regionen/Layers/CH_BOUNDS-Werten selbst.

## Technische Details

- Datei: `src/components/maps/satellite-map.tsx`
- Zeit-Formatierung: `Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })`
- Chip als kleines `<div>` außerhalb des `MapContainer` innerhalb des `relative`-Wrappers, `pointer-events-none`, `z-[450]` (gleich wie der bestehende Lightning-Chip).
