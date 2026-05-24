## Ziel

Zeitslider wie auf MeteoSchweiz Niederschlagsapp: auf Mobile mit dem Finger flüssig hin und her ziehbar (grosse Trefferfläche, Tap-anywhere-on-track), auf Desktop Maus + Tastatur (Pfeiltasten ±1 h, Pos1/End an Anfang/Ende).

## Aktuelle Schwachstellen

- Radix-Slider mit sehr kleinem Thumb (16 px) → schwer mit Finger zu greifen.
- Track nur 6 px hoch → kleiner Treffer.
- Animation `transition: left 220ms` auf Tooltip/Markerlinie → fühlt sich beim Ziehen träge an.
- Stunden-Tick-Labels darunter mit `text` (kein `pointer-events-none`) — könnten Drags abfangen.

## Änderungen

### 1. `src/components/ui/slider.tsx` — neue Variante "touch"
Erweitern um `size?: "default" | "touch"`. Touch-Variante:
- Track: `h-2.5` (10 px), rundere Ecken.
- Thumb: `h-6 w-6` (24 px), kräftigerer Border, sichtbarer Schatten, **zusätzliches unsichtbares Hit-Padding** (`before:absolute before:-inset-3`) → Trefferfläche ~ 48 × 48 px (Apple/Material Guideline).
- Root: `py-3` damit Drag auch oberhalb/unterhalb des Tracks greift.
- `touch-action: none` (bereits da via `touch-none`).
- `aria-label` über Props weiterreichen.

Radix-Slider hat Tap-on-Track + Drag + Pfeiltasten/Home/End bereits eingebaut — keine zusätzliche Logik nötig.

### 2. `src/components/region-map.tsx`
- `<Slider size="touch" aria-label="Prognosezeit" />` verwenden.
- Tooltip- und Marker-Linien-Overlays bleiben `pointer-events-none`.
- `transition: left 220ms` auf Tooltip/Markerlinie **entfernen während aktivem Drag**: einfacher Fix → Übergang verkürzen auf `80ms` oder `0ms`, damit der Tooltip dem Finger sofort folgt. Wähle `0ms` für maximale Direktheit (wie MeteoSchweiz).
- Stunden-Tick-Container (`mt-1 px-1` Block) auf `pointer-events-none` setzen, damit er nie Touches abfängt.
- Slider-Container Padding-Top etwas reduzieren, weil der Thumb grösser wird.

### 3. Tastatur / Verhalten
- Beim Wechsel in `daily`-Mode bleibt Slider disabled.
- In `hourly`-Mode: Fokus auf den Thumb → ← → bewegen ±1 h, Shift+Pfeil = grössere Schritte (Radix Standard ist 1, kann mit `step` und Browser-Default arbeiten). Optional `largeStep`: nicht standardmässig in Radix — überspringe, weil das Web-Pendant von MeteoSchweiz auch nur ±1 h macht.
