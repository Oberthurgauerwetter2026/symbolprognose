# Radar-Timeslider: Verbesserungen

Alle Änderungen ausschliesslich in `src/components/maps/radar-map.tsx`.

## 1. Slider griffiger machen

Aktuell ist das Handle nur ein 3 px breiter Strich → schwer zu greifen, besonders auf Touch.

- Handle wird zu einem **echten Knopf**: 18×18 px rund, weisser Rand, Brand-Farbe, deutlicher Schatten. Bleibt zentriert auf dem Track.
- Vertikaler Strich (dünn) bleibt als optischer Indikator hinter dem Knopf — der Knopf sitzt darauf.
- Hit-Area des Tracks bleibt grosszügig (h-7 mobil), das `:before`-Padding um den Knopf wird auf 16 px erweitert.
- Snap-Verhalten beim Loslassen: aktuell schon vorhanden; beim Drag bleibt es Frame-genau.

## 2. Neue Geschwindigkeiten 1× / 5× / 10× mit Default 2×

- State `speed` startet bei `2`.
- Erlaubte Werte: `[1, 5, 10]` (Default 2 als "Play"-Startwert, nicht in den Pills sichtbar — beim ersten Play wird `2` aktiv; wenn der Nutzer eine Pill wählt, wechselt es).
- Alternative (sauberer): Pills `[1, 2, 5, 10]` mit `2` als Default-aktiv. **Wir nehmen diese Variante**, weil sie konsistenter ist und 2× sonst nicht mehr wählbar wäre.
- `FRAME_MS = 1800 / speed` bleibt unverändert.

## 3. Speed + Loop als Zahnrad-Popover

Sekundär-Toolbar (Jetzt, Speed-Pills, Hagel) wird aufgeräumt:

- Neue Reihenfolge in der Steuerleiste: `Play | Prev | Slider | Next | ⚙` (Zahnrad rechts).
- `Jetzt`-Button bleibt in der Sekundär-Toolbar darunter, zusammen mit `Hagel`.
- **Zahnrad-Button** (`Settings`-Icon von lucide-react) öffnet ein `Popover` (shadcn — bereits im Projekt) mit:
  - **Geschwindigkeit**: Pills `1× / 2× / 5× / 10×`
  - **Auto-Loop**: Switch — wenn aktiv, springt der Slider bei Ende auf Anfang zurück statt zu stoppen.
- Im Play-Loop wird die Loop-Logik ergänzt: am letzten Frame entweder `setPlaying(false)` (Default) oder `setIdx(0)` wenn `loop` aktiv.

## 4. Slider als Overlay in die Karte verlagern

Das ganze Steuer-Panel (weisses `rounded-xl`-Panel mit Play, Slider, Sekundär-Toolbar) wird **aus dem Bereich unter der Karte entfernt** und als schwebendes Panel über der Karte positioniert:

- Position: `absolute bottom-3 left-3 right-3 z-[450]` innerhalb des Map-Containers (analog zur bestehenden Legende oben rechts).
- Hintergrund: `bg-card/95 backdrop-blur` für moderne, semi-transparente Optik. Schatten bleibt.
- Auf Smartphone (`<sm`) wird der gleiche Container voller Breite, weniger Padding (`p-2`), kompaktere Speed-Pills im Popover.
- Map-Container behält seine bisherige Höhe — der Slider liegt **innerhalb** der Karte, kein zusätzlicher Raumbedarf darunter.
- Die `Hinweis: …`- und `Aktualisiert am …`-Zeilen wandern unter die Karte als kleiner Footnote-Text (sonst wird das Overlay zu hoch).

### Skizze

```text
┌────────────────────── Karte ───────────────────────┐
│                                              [Lgnd]│
│                                                    │
│             (Radar-Animation)                      │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ ▶  ◀  ━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━  ▶  ⚙ │  │
│  │ Jetzt                                  Hagel │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
Aktualisiert am … · Quellen: MeteoSchweiz Radar …
```

## Technisches

- Neuer Import: `Settings` aus `lucide-react`, `Popover/PopoverTrigger/PopoverContent` aus `@/components/ui/popover`, `Switch` aus `@/components/ui/switch`.
- `loop`-State (`useState(false)`) in `RadarMap`.
- Play-Loop-`useEffect` bekommt `loop` als Dep; am Ende: `if (next >= frames.length) { if (loop) setIdx(0); else setPlaying(false); }`.
- Speed-Default `useState(2)`.
- Handle-Markup in `MeteoTimeline` (Zeilen 802–824) wird angepasst: Strich bleibt, zusätzlich `rounded-full` Knopf 18×18 darauf.
- Steuer-Panel-Wrapper-`div` (Zeilen 1149–1288) wandert aus dem Root-`<div className="select-none">` heraus und wird innerhalb des `MapContainer`-Wrappers als Overlay-Div positioniert. Footnote-Zeile (Quellen) bleibt unter der Karte als schlichter Text.

## Verifikation

- Lokal Slider greifen + drag — Handle ist deutlich grösser.
- Play startet mit 2×, Pills 1/2/5/10 funktionieren.
- Zahnrad öffnet Popover, Loop-Switch lässt den Loop laufen.
- Mobile-Viewport (375 px): Overlay-Panel liegt sauber unten in der Karte, Slider ist gut bedienbar.
