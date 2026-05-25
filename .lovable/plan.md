## Ziel
Regen, Niesel, Schnee und Gewitter sollen auf den Karten-Symbolen sofort als Niederschlag erkennbar sein. Aktuell sind die Tropfen zu klein und zu blass gegenüber der grauen Wolke.

## Änderungen in `src/components/weather-icons/index.tsx`

**Tropfen (`Drop`)**
- Form deutlich vergrößern (size-Faktor ~1.6) und als echte Tropfenform mit Spitze oben zeichnen statt ovaler Beere.
- Dunkleren, kräftigeren Blauton verwenden und feine dunkle Outline (`stroke`) für Kontrast auf hellem Hintergrund.

**Schneeflocke (`Flake`)**
- Arme länger und dicker, mit dunklem Edge-Stroke darunter für sichtbaren Rand auf weißem/hellem Grund.

**Regen-Icon (`IconRain`)**
- Mehr Tropfen (5–6), größer, in zwei versetzten Reihen, schräg gestellt (Bewegungsrichtung).
- Wolke etwas höher schieben, damit Tropfen voll sichtbar bleiben.

**Niesel-Icon (`IconDrizzle`)**
- Tropfen kleiner als Regen, aber dichter und mit klarem Blau (nicht nur 3 winzige Punkte).

**Schnee-Icon (`IconSnow`)**
- 5 Flocken in zwei Reihen, mit dunkleren Konturen.

**Gewitter (`IconThunderstorm`)**
- Blitz größer und vor Wolke gelegt, Tropfen größer.

**Farb-Tokens in `src/styles.css`**
- `--wx-rain` von `#1d6fb8` auf kräftigeres `#0b4f8a` und neue Variable `--wx-rain-edge: #062f55` für Tropfen-Outline.
- `--wx-snow-edge` etwas dunkler, damit weiße Flocken auf hellem Pin sichtbar bleiben.

## Nicht-Ziel
Keine Änderung an Sonne/Mond/Wolken-Grundformen oder am Dispatcher-Mapping (WMO-Codes bleiben gleich).
