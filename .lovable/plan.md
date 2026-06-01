## Problem

Drop hat bei `size=1` Höhe ~12 (von y−5 bis y+6.5). Aktuelle Positionen `y=58` und `y=60` (size 0.9) reichen bis y≈63.85 / 65.85 → unten am viewBox (64) abgeschnitten.

## Änderung — `src/components/weather-icons/index.tsx`

Alle Tropfen-/Flocken-Y-Werte in `IconSunThunder` und `IconSunSnowThunder` um ~4 Einheiten nach oben verschieben:

```tsx
<Drop x={44} y={46} size={0.9} tilt={-12} />
<Drop x={56} y={46} size={0.9} tilt={-12} />
{intensity >= 3 && <Drop x={50} y={54} size={0.9} tilt={-12} />}
{intensity >= 4 && <Drop x={42} y={54} size={0.9} tilt={-12} />}
```

Analog `<Flake/>` in `IconSunSnowThunder` (gleiche Koordinaten, `size={0.95}`).

Tropfen-BBox bleibt vollständig im viewBox 0–64:
- y=46 → 40.85–51.85 (Wolkenboden ~42, leichter Überlapp = visuell verbunden).
- y=54 → 48.15–59.85 ✓.
- x≥42 → kein Overlap mit Bolt (x 24–38).