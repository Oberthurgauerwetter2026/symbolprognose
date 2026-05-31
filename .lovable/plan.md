## Ziel

Messung und Prognose sollen **dieselbe Farbskala** zeigen und visuell synchron wirken — wie auf MeteoSchweiz / DWD. Die Prognose-Bubbles dürfen nicht mehr weichgezeichnet wirken, sondern brauchen **scharfe Iso-Kontur-Bänder** mit klaren Strukturen, analog zur MCH-CombiPrecip-Darstellung.

## Befund

- **Messung** = MeteoSchweiz-CombiPrecip-PNG → Original-MCH-Farben, harte quantisierte Bänder.
- **Prognose** = Canvas-Render der ICON-CH1/CH2-Werte via `SCALE`/`colorFor` → derzeit log-interpoliert → weicher, „wattiger" Look, der nicht zur Messung passt.
- `PrecipOverlay` zeichnet bereits sigmoid-geschärfte bilineare Interpolation (`SHARP=7`) — gibt runde Bubble-Ränder mit harten Band-Übergängen, sobald `colorFor` quantisiert ist. Das ist genau der MCH-Look.
- `PrecipOverlay` läuft nur für Prognose-Frames (`hasGrid && !hasPng`), nicht für Messung — die früher beobachtete Ring-Flicker-Problematik existiert in der aktuellen Render-Logik nicht mehr.

Lösung: SCALE auf MCH-CombiPrecip-Farbpalette ausrichten und `colorFor` quantisieren. Damit zeigt die Prognose dieselben Farben in denselben mm/h-Stufen wie das MCH-PNG — Messung und Prognose laufen optisch ineinander über.

## Änderungen

### `src/components/maps/radar-map.tsx`

**1. `SCALE` an MCH-CombiPrecip-Legende ausrichten** (mm/h-Stufen wie auf <https://www.meteoschweiz.admin.ch/wetter/wetter-und-klima-aktuell/niederschlagsradar.html>):

```text
 0.1   sehr leicht    [165, 215, 245]   hellblau
 0.3   leicht         [ 90, 165, 230]   blau
 1     mässig leicht  [ 30,  80, 200]   dunkelblau
 3     mässig         [ 40, 170,  70]   grün
 10    mässig stark   [245, 220,  40]   gelb
 30    stark          [240, 140,  30]   orange
 60    sehr stark     [220,  30,  30]   rot
 100   extrem         [160,  30, 180]   magenta
```

Kommentar oben: „Niederschlags-Farbskala (mm/h) — MeteoSchweiz-CombiPrecip-Legende. Gleiche Stufen für Messung (PNG) und Prognose (Canvas)."

**2. `colorFor` quantisiert** (harte Bänder, keine Interpolation):

```ts
function colorFor(mmh: number): [number, number, number, number] {
  if (mmh < SCALE[0].mmh) return [0, 0, 0, 0];
  let band = SCALE[0];
  let isTop = false;
  for (let i = SCALE.length - 1; i >= 0; i--) {
    if (mmh >= SCALE[i].mmh) { band = SCALE[i]; isTop = i === SCALE.length - 1; break; }
  }
  return [band.rgb[0], band.rgb[1], band.rgb[2], isTop ? 0.95 : 0.9];
}
```

In Kombination mit der bereits vorhandenen sigmoid-geschärften bilinearen Interpolation in `PrecipOverlay` (`SHARP=7`) ergeben sich Bubble-Konturen mit weichen, runden Aussenrändern und harten, MCH-typischen Band-Übergängen im Inneren — keine Wattewolken mehr.

**3. Canvas-Filter** unverändert lassen (`saturate(1.3) contrast(1.2)`) — verstärkt die Band-Strukturen zusätzlich.

### Nicht angefasst

- `SNOW_SCALE` / `snowColorFor`.
- `PrecipOverlay`-Logik (Sigmoid-Sharpening, bilineare Interpolation, Skip bei PNG-Frames) — Render-Pipeline ist korrekt, nur die Farb-Lookup-Funktion ändert sich.
- `src/lib/radar.functions.ts`, Bias-Korrektur, Forecast-Cutoff, R2-Ingest, Hagel-Overlay.
- Legende rechts oben — übernimmt die neue SCALE automatisch (mit den 8 mm/h-Stufen).
- Quellen-Badge / Timeline.

## Verifikation

- `/karten/radar` öffnen, Animation laufen lassen vom letzten Messzeitpunkt in die Prognose:
  - Übergang Messung (PNG) → Prognose (Canvas) zeigt **gleiche Farben** in gleichen mm/h-Stufen, keine sichtbare Farbabweichung.
  - Prognose-Bubbles haben **scharfe Iso-Kontur-Bänder** wie MCH, nicht mehr weichgezeichnet.
- Legende oben rechts: 0.1 / 0.3 / 1 / 3 / 10 / 30 / 60 / 100 mm/h, MCH-Farben.

## Dateien

- `src/components/maps/radar-map.tsx`
