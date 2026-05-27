# Nowcast Wind-Fallback: Bewegungsrichtung umdrehen

## Problem

Beim Nowcast mit `motionSource: "wind"` ziehen die Niederschläge sichtbar in die falsche Richtung (rückwärts gegenüber der erwarteten Verlagerung). Die theoretische Meteo-Formel in `src/lib/radar.functions.ts` (Zeilen 315–317) ist zwar lehrbuch-konform (Wind „aus" Richtung → Vektor invertiert), produziert im Bild aber das umgekehrte Ergebnis.

## Änderung

**Datei:** `src/lib/radar.functions.ts`, Zeilen 313–317 (nur Wind-Fallback-Block, ca. Zeile 308–325).

Vorzeichen in der Wind-zu-Vektor-Umrechnung umkehren:

```ts
// vorher
const uMs = -speedMs * Math.sin(rad);
const vMs = -speedMs * Math.cos(rad);

// nachher
const uMs = speedMs * Math.sin(rad);
const vMs = speedMs * Math.cos(rad);
```

Kommentar ebenfalls anpassen, sodass die Konvention dokumentiert ist (in dieser Code-/Bilder-Pipeline wird `wind_direction` als „wohin der Wind weht" behandelt).

## Nicht im Scope

- `meanWindAt` (Zeilen 401–432, ICON-CH1-Zwischenadvektion) bleibt unverändert — wurde nicht beanstandet.
- Keine Änderung an radar-basierter Motion, Phasenkorrelation, Farbpaletten oder Labels.

## Verifikation

- Nach Reload + Cache-Ablauf (max-age 60 s): Niederschlag in den Wind-Fallback-Frames muss sich mit dem Wind verlagern (z. B. bei W-Wind nach Osten).
- Radar-basierte Nowcast-Verlagerung (`motionSource: "radar"`) bleibt unverändert korrekt.
