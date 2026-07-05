## Ziel
Bei Satellit und Wind wird das Steuerpanel mit dem Filmstrip nicht mehr als schwebendes Overlay über der Karte gerendert, sondern (analog Radar) als eigenständiges Panel **unterhalb** der Karte. Im Embed-/`bare`-Modus bleibt das schwebende Overlay erhalten — genauso wie beim Radar.

## Umsetzung

### `src/components/maps/satellite-map.tsx`
- Das Steuerpanel-Block (`{total > 0 && ( <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[450] ..."> ... </div> )}`, aktuell innerhalb des Map-Wrappers) aus dem Map-Container heraus verschieben — als Sibling **nach** dem schließenden Map-Wrapper-`</div>`.
- Wrapper-Styling analog Radar:
  - `bare`: `pointer-events-none absolute inset-x-2 bottom-2 z-[450] sm:inset-x-3 sm:bottom-3` (unverändert schwebend).
  - Nicht-`bare`: `w-full` (Panel unter der Karte, im normalen Fluss).
- Innerer Panel-Container ebenfalls konditional stylen:
  - `bare`: `pointer-events-auto bg-white/90 shadow-lg backdrop-blur` + gemeinsame Klassen (`rounded-xl border border-neutral-200 p-2 sm:p-2.5`).
  - Nicht-`bare`: `bg-white shadow-sm` + gemeinsame Klassen.
- `cn` aus `@/lib/utils` ist bereits importiert.

### `src/components/maps/wind-map.tsx`
- Analog: Steuerpanel-Block (`<div className="pointer-events-none absolute inset-x-2 bottom-2 z-[450] ...">...</div>`) aus dem Map-Wrapper herauslösen und **nach** dem schließenden Map-Wrapper-`</div>` (vor dem `{data && ( <p ...>Aktualisiert …</p> )}`-Block) einfügen.
- Wrapper-Styling identisch zu Satellit (bare = floating, sonst = w-full-Panel unter der Karte).

## Was NICHT geändert wird
- Radar-Layout, FilmstripTimeline-Komponente, Datenquellen, Farben, Overlays.
- Play/Pause-, Prev/Next-, Settings-Buttons, Popover, Legende, Quellen-Badge.
- Alle Zoom-/Interaktions-Handler der Karten.

## Betroffene Dateien
- `src/components/maps/satellite-map.tsx`
- `src/components/maps/wind-map.tsx`

## Verifikation
- `bunx tsgo --noEmit`.
- Preview `/karten/satellit` und `/karten/wind`: Panel mit Filmstrip erscheint als eigenständiger Block unter der Karte (nicht mehr schwebend). Legende/Badges bleiben in der Karte.
- Embed-Routen (`/embed/satellit`, `/embed/wind`): schwebendes Overlay unverändert (bare-Modus).
