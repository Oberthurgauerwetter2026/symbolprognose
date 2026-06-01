## Änderung — `src/components/weather-icons/index.tsx`, `IconSunThunder`

Aktuell: 1 Tropfen + Bolt. Gewünscht: **3 Tropfen mit Blitz mittig dazwischen** (analog `IconSunShower`-Layout, plus Bolt zentriert).

```tsx
export function IconSunThunder({ size, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <Sun cx={20} cy={20} r={9} />
      <Cloud x={38} y={32} scale={1} dark />
      <Drop x={32} y={52} size={0.9} tilt={-12} />
      <Drop x={52} y={52} size={0.9} tilt={-12} />
      <Bolt />
      <Drop x={42} y={56} size={0.9} tilt={-12} />
    </Svg>
  );
}
```

Bolt liegt zwischen den seitlichen Tropfen und überdeckt visuell den mittleren Tropfen leicht — Reihenfolge: linker + rechter Tropfen → Bolt → mittlerer (oder Bolt zuletzt, je nach gewünschtem Overlap). Wir rendern den mittleren Tropfen **vor** dem Bolt, damit der Blitz oben liegt und „in der Mitte" sitzt.

Analog `IconSunSnowThunder`: 3 `<Flake/>` statt Tropfen, Bolt zentriert.