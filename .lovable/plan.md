## Slider & Playbutton Verbesserungen

### 1. Slider größer & touch-freundlicher machen
- **Track-Hit-Area**: Von `h-4` auf `h-7` (Mobile) / `h-5` (Desktop) erhöhen, damit das Touch-Target deutlich größer ist.
- **Track-Linie**: Von `h-[3px]` auf `h-[4px]` dicker.
- **Handle**: Von `h-4 w-0.5` auf `h-5 w-[3px]` vergrößern, damit er besser gegriffen werden kann.
- **Touch-Hit-Area**: `before:absolute before:-inset-2` auf dem Handle-Bereich, damit Finger nicht so präzise treffen müssen.
- **Haptik**: `navigator.vibrate(8)` bei `onPointerDown` (Drag-Start) und beim Frame-Wechsel in der Play-Loop (nur wenn `playing` aktiv ist).
- **Hour-Labels**: Auf Mobile von `text-[9px]` auf `text-[10px]` und Abstand anpassen.
- **Bubble/Label**: Auf Mobile etwas größer (`text-[11px]`) für bessere Lesbarkeit.

### 2. Playbutton blau einfärben
- Play/Pause-Button: Icon-Farbe von neutral (`text-neutral-700`) auf Brand-Blau (`text-[#2561a1]`) ändern.
- Beim aktiven Play-Zustand: Icon-Farbe ebenfalls blau statt neutral.
- Optional: Border-Farbe im Play-Zustand leicht blau (`border-[#2561a1]/40`).

### Betroffene Dateien
- `src/components/maps/radar-map.tsx` — Timeline-Komponente (Slider), Playbutton-Styles, Play-Loop-Haptik.