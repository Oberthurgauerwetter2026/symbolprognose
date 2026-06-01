## Problem

Bolt-BBox in `<Bolt/>` (Z. 198): `x 24–38, y 41–63` (Viewport 64×64). Tropfen am Mittel-/Unterrand werden vom Blitz überdeckt. Außerdem soll die **Tropfenanzahl mit der Intensität** skalieren.

## Änderung — `src/components/weather-icons/index.tsx`

### 1. `IconSunThunder` / `IconSunSnowThunder` bekommen `intensity`-Prop

Anzahl Tropfen/Flocken: `2` (leicht) bis `4` (heftig). Positionen liegen **rechts vom Bolt** (Bolt = links unter der Wolke), Cloud sitzt bei x=38, also passt Bereich x≈40–60 unter der Wolke. Bolt-Streifen (x 24–38, y 41–63) bleibt frei.

```tsx
export function IconSunThunder({ size, intensity = 2, ...rest }: IconProps & { intensity?: 2 | 3 | 4 }) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={20} cy={20} r={9} />
      <Cloud x={38} y={32} scale={1} dark />
      <Bolt />
      {/* Tropfen rechts neben dem Bolt, keine Überlappung mit x 24–38 */}
      <Drop x={44} y={50} size={0.9} tilt={-12} />
      <Drop x={56} y={50} size={0.9} tilt={-12} />
      {intensity >= 3 && <Drop x={50} y={58} size={0.9} tilt={-12} />}
      {intensity >= 4 && <Drop x={42} y={60} size={0.9} tilt={-12} />}
    </Svg>
  );
}
```

Analog `IconSunSnowThunder` mit `<Flake/>`.

### 2. Dispatcher (Z. 444–461)

`intensity` aus Tages-Niederschlag ableiten:

```ts
const sunIntensity: 2 | 3 | 4 =
  (precip ?? 0) >= 10 ? 4 : (precip ?? 0) >= 4 ? 3 : 2;
```

und an `IconSunThunder` / `IconSunSnowThunder` durchreichen.

## Verifikation

- Amriswil/Di (precip=12.3, th=1, sunny) → `intensity=4` → 4 Tropfen + sichtbarer Blitz links.
- 2 mm Tagessumme, 1 h Gewitter, sonst sonnig → `intensity=2` → 2 Tropfen + Blitz.
- Kein Tropfen überlappt mit Bolt-BBox.