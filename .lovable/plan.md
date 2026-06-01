## Problem (verifiziert für Amriswil, Di 02.06.)

Open-Meteo Tageswerte: `wc=95`, `precip=12.3 mm`, `precipHours=4`, `sun=6.7 h`.
Stündlich: 00–16 Uhr Code 2/3 ohne Niederschlag, 17–21 Uhr eine einzige Gewitterstunde (19 Uhr, 5.8 mm) plus Regen drumherum.

Aktuelle Logik (`src/components/weather-icons/index.tsx`, Z. 418–429) schaltet wegen `(thunderHours ≥ 1 && precip ≥ 8)` auf **`IconThunderstorm` (Vollgewitter)** — obwohl der Tag fast komplett sonnig ist und nur 1 h Gewitter hat. Erwartet: **`IconSunThunder`** (Sonne-Wolke-Tropfen-Blitz). Im Winter analog mit Schneeflocke statt Tropfen.

## Änderungen

### 1. `src/components/weather-icons/index.tsx` — neuer Winter-Wrap

Neue Komponente `IconSunSnowThunder` (Sonne + dunkle Wolke + Flake + Bolt), analog zu `IconSunThunder` aber mit `<Flake/>` statt `<Drop/>`. Zusätzlich `IconSnowThunder` (Wolke + Flake + Bolt) als heavy-Snow-Thunder.

### 2. `src/components/weather-icons/index.tsx` — Daily-Dispatcher (Z. 418–429)

Threshold-Mix entschärfen, sodass **isolierte Gewitterstunden auf sonst sonnigem Tag** zu `IconSunThunder` werden, statt zu Vollgewitter. Neuer Block:

```ts
if (scope === "daily" && ((thunderHours ?? 0) >= 1 || wmoIsThunder)) {
  const th = thunderHours ?? 0;
  const sunny = (sunshineRatio ?? 0) >= 0.15 && (precipHours ?? 0) < 8;

  // Vollgewitter nur, wenn das Gewitter den Tag prägt
  const heavyThunder =
    th >= 3 ||
    (th >= 2 && (precip ?? 0) >= 8) ||
    (wmoIsThunder && (precipHours ?? 0) >= 5 && !sunny);

  if (heavyThunder) {
    return isSnow ? <IconSnowThunder {...props} /> : <IconThunderstorm {...props} />;
  }
  if (sunny) {
    return isSnow ? <IconSunSnowThunder {...props} /> : <IconSunThunder {...props} />;
  }
  return isSnow ? <IconSnowThunder {...props} /> : <IconThunderstorm {...props} />;
}
```

Was sich konkret ändert:
- alte `(th ≥ 1 && precip ≥ 8)`-Klausel entfällt → 1-h-Abendgewitter mit kräftigem Niederschlag bei sonst viel Sonne bleibt `IconSunThunder`.
- `th ≥ 2`-Schwelle wird auf `th ≥ 3` angehoben, `2 h` brauchen jetzt zusätzlich ≥ 8 mm.
- `wmoIsThunder && precipHours ≥ 3` wird zu `≥ 5 && !sunny` — vermeidet, dass viel Sonne weggewischt wird.
- Winter: bei `isSnow` jeweils Schnee-Pendant.

### 3. Keine Änderungen an `weather.ts`, kein Cache-Bump.

## Verifikation

- **Amriswil/Di**: th=1, precip=12.3, pHrs=4, sun=6.7h → `sunny=true`, kein heavyThunder → **`IconSunThunder`** ✅
- **3 h Gewitter, durchgehender Regen, pHrs=8**: `heavyThunder` via `th≥3` → `IconThunderstorm` ✅
- **Winter-Pendant (isSnow + th=1 + Sonne)**: → `IconSunSnowThunder` ✅
- **Stündliche Icons** unverändert (Block läuft nur in `scope === "daily"`).