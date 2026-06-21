# Niederschlags-Prognose: rechteckige Hülle aufbrechen

Im Screenshot zeigt sich: die inneren Iso-Bänder sind organisch, aber die äussere Hülle des Niederschlagsfeldes ist ein Rechteck mit abgerundeten Ecken. Ursache: das Datengrid endet an einer Lat/Lon-Box; selbst nach dem rotierten fBm-Warp (`mod = 0.3..1.75`) bleibt der minV-Schwellwert (`0.05`) annähernd entlang dieser Box stehen, weil `mod` nie unter 0.3 fällt.

Ziel laut Nutzer: keine geraden Linien, keine 90°-Ecken — aber **keine** zusätzliche Glättung / Weichzeichnung. Die diskreten Iso-Bänder (`colorFor`) bleiben hart.

## Änderung in `src/components/maps/radar-map.tsx`, Block ~510–527 (`if (contour && v > 0)`)

Zusätzlich zum vorhandenen Warp/Mod einen **groben Envelope-Noise** einbauen, der die Aussenkanten organisch zerfasert:

```ts
if (contour && v > 0) {
  const sx = fxRaw * 0.9;
  const sy = fyRaw * 0.85;
  const rx = sx * COS - sy * SIN;
  const ry = sx * SIN + sy * COS;

  // Feines Detail-Warp (wie bisher)
  const warpX = (fbm(rx * 0.35 + 17.3, ry * 0.35 - 4.1) - 0.5) * 2.6;
  const warpY = (fbm(rx * 0.35 - 9.7, ry * 0.35 + 23.4) - 0.5) * 2.6;
  const n = fbm(rx + warpX, ry + warpY);
  const mod = 0.25 + n * 1.55;

  // NEU: grossräumiger Envelope-Noise (0.05 .. 1.7) — kann v gegen 0 ziehen,
  // wodurch die minV-Schwelle in einer welligen Linie verläuft und die
  // Grid-Bbox aufgebrochen wird. Keine Glättung — nur Maskierung.
  const envX = rx * 0.12 - 5.7;
  const envY = ry * 0.12 + 11.2;
  const env = fbm(envX, envY);                // 0..1
  const envelope = Math.max(0, env * 1.9 - 0.18); // ~0..1.7, mit echten Nullen

  v = v * mod * envelope;
}
```

Wirkung:
- `envelope` erreicht echte 0 → äussere Bandgrenze wird unregelmässig zerschnitten, keine Bbox-Linie mehr.
- `mod`-Untergrenze gesenkt (0.25 statt 0.3) → schärfere Inseln am Rand der intensiveren Bänder.
- Warp-Amplitude leicht erhöht (2.2 → 2.6) → mehr Verzerrung an Bandkanten.
- `colorFor` und `imageSmoothingEnabled = false` bleiben unverändert → keine Weichzeichnung, harte Iso-Kanten.

## Verifikation

`/karten/radar` öffnen, Prognose-Frame (Source ≠ "radar") wählen. Aussenkontur des Niederschlagsfeldes ist organisch / wolkenartig, keine sichtbaren waagerechten/senkrechten Kanten oder 90°-Ecken. Innere Bänder bleiben pixelig-hart wie bisher.
