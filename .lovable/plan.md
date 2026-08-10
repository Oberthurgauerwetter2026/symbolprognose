# Blitz-Glow reduzieren

Der Nutzer möchte den Glow-Effekt der Blitz-Symbole im Radar und Satellitenbild dezenter gestalten.

## Was geändert wird

- In `src/components/maps/lightning-bolt.ts` werden die Glow-Parameter der `boltSvg`-Funktion reduziert:
  - Drop-Shadow-Radien kleiner (weniger weicher Schein).
  - Opazität des breiten Glow-Strokes reduzieren.
  - Optional: Strichstärke des Glow-Pfads leicht verringern.
- Damit ändern sich automatisch Karte und Legende in Radar und Satellitenbild, da beide dasselbe Modul verwenden.

## Technisch

- Anpassungen nur in `src/components/maps/lightning-bolt.ts`.
- Keine Änderungen an Daten, Animation, Toggle-Button oder `localStorage`.
