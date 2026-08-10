# Blitze standardmässig aktiv, keine Spiegelung im Satellitenbild

## Ziel
- Blitze sind in Radar und Satellitenbild **standardmässig eingeschaltet**; der Button dient zum Ausschalten.
- Im Satellitenbild werden Blitze wie im Radar **nicht mehr gespiegelt** dargestellt.

## Änderungen

**Radar (`src/components/maps/radar-map.tsx`)**
- Startwert des Blitz-Schalters auf "an" umstellen: nur wenn der Nutzer aktiv ausgeschaltet hat (gespeicherter Wert `0`), bleibt es aus.

**Satellitenbild (`src/components/maps/satellite-map.tsx`)**
- Gleiche Umstellung des Startwerts auf "an".
- Beim Zeichnen der Blitz-Symbole `mirrored` fest auf `false` setzen, Neigung (Tilt) bleibt für ein natürliches Bild erhalten.

## Technisches Detail
Die localStorage-Logik wechselt von `getItem(...) === "1"` auf `getItem(...) !== "0"`, damit ein fehlender Eintrag "aktiv" bedeutet und die Nutzerwahl weiterhin erhalten bleibt. Die Farb-/Glow-Abstimmung des Satellitenbilds (Alterungsfarben) bleibt unverändert.
