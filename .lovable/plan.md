## Problem

In `src/lib/weather.ts` (`aggregateDailyFromHourly`, Z. 545–660) werden **alle** Tages-Kennzahlen über das 06–21-Fenster (`idxs`) berechnet. Für **Temperatur-Min/Max** und **Wind** (Geschwindigkeit, Böen, Dominantrichtung) ist das fachlich falsch:

- Tagesminimum liegt meist nachts (03–06 Uhr) → wird heute abgeschnitten.
- Sturmböen / Föhnspitzen treten oft abends/nachts auf → fehlen.

Icons/Niederschlag/Sonne sollen weiterhin 06–21 nutzen.

## Änderung — `src/lib/weather.ts`, `aggregateDailyFromHourly`

Zusätzlich zum bestehenden `idxs` (06–21, „Day-Window") ein zweites Index-Set `allIdxs` für den vollen Kalendertag (00–23) bauen:

```ts
const allIdxs: number[] = [];
for (let i = 0; i < h.time.length; i++) {
  const t = h.time[i] ?? "";
  if (t.slice(0, 10) === day) allIdxs.push(i);
}
const finiteAll = (arr: number[] | undefined): number[] =>
  allIdxs.map((i) => arr?.[i]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
```

Im Return-Block (Z. 649–…) auf `finiteAll` umstellen für:
- `temperature_2m_max`, `temperature_2m_min`
- `windspeed_10m_max`, `windgusts_10m_max`
- `winddirection_10m_dominant` (auch Berechnung der Vektor-Mittelung Z. 569–582 auf `finiteAll(h.winddirection_10m)` / `finiteAll(h.windspeed_10m)` ziehen)

Unverändert auf `idxs` (06–21):
- `precipitation_sum`, `precipitation_hours`, `thunderstorm_hours`
- `sunshine_duration`, `sunshineRatio`
- Wolken-Stockwerk-Mittelwerte (`cloudLowMean` etc.) und der daraus abgeleitete `weathercode`
- `dryHours`, `maxHourlyPrecip`, `isDry/isShowerDay/isPersistentRain`-Klassifikation

## Verifikation

- Klare Nacht 4 °C / sonniger Tag 18 °C → `temperature_2m_min` = 4 °C (vorher ~10 °C).
- Föhnsturm 23 Uhr 95 km/h, tagsüber 30 km/h → `windgusts_10m_max` = 95 km/h.
- Tages-Icon (Amriswil/Di Gewitter 19 Uhr) bleibt unverändert, da Icon-Logik weiter auf `idxs` rechnet.