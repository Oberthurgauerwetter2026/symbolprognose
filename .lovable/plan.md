## Ziel

1. Prognose-Frames in der Radarkarte auf **Stunden-Takt** umstellen (statt aktuell 15-min ICON-CH1).
2. Bodensee in der Radarkarte **vollflächig** einfärben wie auf der Wetterkarte Region.

## Änderungen

### A. Stunden-Takt für die Prognose (`src/lib/radar.functions.ts`)

In der `phase1`-Schleife (`ref1.time`) nur jeden Frame übernehmen, dessen Minute `:00` ist (also jede volle Stunde). Vergangenheit (echte MCH-Radar-PNGs) bleibt unverändert in ihrem nativen 5-min-Takt.

```ts
for (let ti = 0; ti < ref1.time.length; ti++) {
  const tIso = ref1.time[ti] + "Z";
  const tMs = Date.parse(tIso);
  if (tMs <= now && hasRealRadar) continue;
  if (tMs > forecastCutoff) continue;
  // NEU: nur volle Stunden für die Prognose
  if (tMs > now && new Date(tMs).getUTCMinutes() !== 0) continue;
  …
}
```

### B. Cross-Fade-Interpolation entfernen (`src/components/maps/radar-map.tsx`)

Da Stunden-Schritte ohnehin sichtbar groß sind und der User explizit auf Stundentakt umstellt, ist die Cross-Fade-Logik nicht mehr nötig. Rückbau:

- `subProgress` / `requestAnimationFrame`-Loop → wieder `setInterval` mit 800 ms / `speed` und `setIdx(next)`.
- `PrecipOverlay`-Props `nextFrame` und `progress` entfernen; Render-Effekt zurück auf `[frame, payload]`.
- `blendNext`-Berechnung im `RadarMap`-Body entfernen.

### C. See vollflächig wie Region-Karte (`src/components/maps/radar-map.tsx`)

- Lake-Style angleichen an `region-map.tsx`: `fillOpacity: 1`, `weight: 0.6`, gleiche Farben (`#6bb6d6` / `#7ec8e3`).
- `LakePane` mit `zIndex: 350` bleibt zwar funktional, aber zur Konsistenz auf den **default `overlayPane`** zurückstellen (kein eigener Pane, `pane`-Prop entfernen, Pane-Creation-Effekt löschen) — dann liegt der See in der natürlichen Reihenfolge **über** dem Precipitation-Canvas, identisch zur Region-Karte (die ja gar keinen Ns-Layer hat).

## Nicht angefasst

- Vergangenheits-Frames (echte MCH-CPC-PNGs, 5-min) bleiben unverändert.
- Datenpipeline / Ingest-Skript / R2 / BBox / Legende / Hagel-Layer / Farbskalen / Filter / Edge-Fade / Touch- & Keyboard-Bedienung.
- Wetterkarte Region selbst.