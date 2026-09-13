# Tropfensymbolik schmaler machen

## Ziel
Die Regentropfen in der Stunden- und Tagesprognose sollen noch schlanker wirken, damit sie sich bei mehreren Tropfen unter einer Wolke nicht überlappen und professioneller aussehen.

## Änderungen

1. **Client-Renderer (`src/components/weather-icons/index.tsx`)**
   - In der `Drop`-Komponente den horizontalen Skalierungsfaktor `sx` weiter reduzieren, z. B. von `sy * 0.72` auf `sy * 0.58`.
   - Form, Animation, Farbe und Highlight bleiben unverändert.

2. **Server-Renderer (`src/lib/weather-icon-svg.server.ts`)**
   - Gleiche Reduktion des `sx`-Faktors in der `drop`-Funktion, damit eingebettete/serverseitige SVGs identisch zum React-Client aussehen.

## Nicht im Scope
- Keine Änderung der Tropfenpositionen, Animation oder Farben.
- Keine Änderung an anderen Wettersymbolen (Schnee, Blitz, Wolken).

## Validierung
- Typecheck (`bunx tsgo --noEmit`) muss erfolgreich sein.
- Visueller Check in der Vorschau: Tropfen unter einer Wolke erscheinen deutlich schmaler und klarer getrennt.
