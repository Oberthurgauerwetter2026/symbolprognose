# Animierte Regentropfen in den Lokalprognosen

## Ziel
Die Regentropfen in den Wettersymbolen (Lokalprognose, Tages-/Stundenkacheln) fallen sanft animiert von der Wolke nach unten, statt statisch zu stehen.

## Umsetzung

1. **Drop-Komponente animieren** (`src/components/weather-icons/index.tsx`)
   - Jeder Tropfen bekommt eine SMIL-Animation (`<animateTransform>` + Opazitäts-Loop): Tropfen startet oben an der Wolke, fällt leicht schräg (bestehender 10°-Tilt) nach unten und blendet am Ende aus — danach Loop von vorn.
   - Gestaffelte `begin`-Offsets pro Tropfen (z. B. 0 / 0,4 / 0,8 s), damit die Tropfen versetzt fallen und nicht synchron.
   - Fallgeschwindigkeit dezent (ca. 1,2–1,6 s pro Zyklus), kurze Fallstrecke (ca. 6–8 px), damit es ruhig und wetterdiensttauglich bleibt.
   - Schneeflocken, Blitze und alle anderen Symbolteile bleiben statisch.

2. **Reduzierte Bewegung respektieren**
   - Bei `prefers-reduced-motion` bleiben die Tropfen statisch (Animation per `display: none` auf einem Wrapper bzw. CSS-Media-Query im SVG-`<style>`-Block deaktiviert).

3. **Einbettungen**
   - Der serverseitige SVG-Renderer (`src/lib/weather-icon-svg.server.ts`) bekommt dieselbe Tropfen-Animation, damit die Symbole auch in den WP-Embeds animiert erscheinen (SMIL läuft in SVG-Bildern in allen modernen Browsern).

## Technisch
- Rein deklarativ (SMIL), kein JavaScript, kein Performance-Einfluss auf Scrollen/Loop.
- Keine Änderung an Symbol-Auswahl, Farben oder Schwellenlogik.

## Prüfung
- Typecheck + Build.
- Kurzer Sichtcheck: Regen-/Schauer-Symbol in der Lokalprognose zeigt fallende Tropfen; reduzierte Bewegung zeigt statische Tropfen.
