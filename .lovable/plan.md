# Schneeflocken sanft schwebend fallen lassen

## Ziel
Schneeflocken in allen Wettersymbolen fallen langsam und pendeln leicht hin und her – ruhiger als die Regentropfen.

## Umsetzung
1. **Animation ergänzen** (`src/components/weather-icons/index.tsx`)
   - Neue CSS-Animation `wx-flake-fall` im bestehenden Animations-Block: ca. 3 s pro Zyklus, Fallstrecke ca. 6 px, seitliches Pendeln ±1,5 px, langsame Drehung, Ein-/Ausblenden.
   - Flocken-Gruppe bekommt Klasse `wx-flake-anim` mit versetztem Start (gleiche Logik wie `dropDelay`), damit sie nicht synchron fallen.
   - `prefers-reduced-motion`: Flocken bleiben statisch.
2. **Einbettungen** (`src/lib/weather-icon-svg.server.ts`): `flake()` erhält dieselbe Klasse und Verzögerung, damit WP-Embeds identisch aussehen.
3. Betrifft Schnee, Schneeschauer und Schnee-Gewitter-Symbole. Form, Farben und Symbolwahl unverändert.

## Symbolkatalog
Alle Symbole inkl. Animation sind unter `/intern/icons` einsehbar – dort prüfe ich das Ergebnis per Screenshot.
