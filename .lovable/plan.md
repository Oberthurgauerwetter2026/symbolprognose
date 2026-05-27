## Problem

1. In `IconRain` (und teilweise `IconThunderstorm`, `IconSnow`) liegen Tropfen/Flocken so tief, dass sie über den `viewBox` (0–64) hinausragen und unten abgeschnitten werden. Beispiel: Tropfen bei `y=58`, `size=1.4` reicht bis `y ≈ 67`.
2. Regenfarbe `--wx-rain: #0b4f8a` mit `--wx-rain-edge: #062f55` ist dunkelblau auf dunkelblau — schlecht erkennbar auf blauem Karten-/Widget-Hintergrund. Auch der Drop hat aktuell `opacity="0.85"` und nur `strokeWidth="0.5"`, was den Kontrast weiter reduziert.

## Änderungen in `src/components/weather-icons/index.tsx`

### A) Tropfen-/Flockenpositionen nach oben rücken (alles innerhalb viewBox 64)

- `IconRain`: Cloud `y=24` → `y=22`. Tropfen-Reihen:
  - obere Reihe `y=48` → `y=44`
  - mittlere Reihe `y=52` → `y=48`
  - untere Reihe `y=58` → `y=54`
- `IconThunderstorm`: Tropfen `y=52` → `y=48`; Bolt entsprechend hochziehen (`d`-Pfad um ca. 3 Einheiten nach oben).
- `IconDrizzle`: Cloud `y=26` → `y=24`; Tropfenreihen `y=48`/`52` → `y=46`/`50`.
- `IconSnow`: Cloud `y=26` → `y=24`; Flocken `y=48`/`52`/`59` → `y=44`/`48`/`55` (size 1.1/1.2 reicht sonst bis 64).

### B) Bessere Sichtbarkeit auf weissem und blauem Hintergrund

In `src/styles.css`:
- `--wx-rain`: `#0b4f8a` → `#38bdf8` (helles Cyan-Blau, hebt sich auf dunkelblauem Karten-Hintergrund ab)
- `--wx-rain-edge`: `#062f55` → `#0c2a4a` (kräftige dunkle Kontur, gut sichtbar auf weiss)

In `Drop()` (Zeile 145–158):
- `strokeWidth="0.5"` → `strokeWidth="1"` (klare Kontur)
- `opacity="0.85"` entfernen (volle Deckkraft)

Schnee bleibt unverändert (weiss + dunkle Kontur funktioniert bereits auf beiden Hintergründen).

## Nicht betroffen

- Radar-Karte / `radar-map.tsx` (andere Komponente).
- Cloud-, Sun-, Moon-, Fog-, Bolt-Farben.
