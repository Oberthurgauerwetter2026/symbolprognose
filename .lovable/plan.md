## Ziel
Gemeindenamen auf der Warnkarte etwas kleiner darstellen und exakt in der Gemeindefläche zentrieren (aktuell laufen alle Namen nach rechts aus).

## Ursache
In `src/components/maps/warn-map.tsx` erzeugt `labelIcon` ein DivIcon mit `iconSize: [0,0]`. Das innere `<div>` ist ein Block-Element und erbt damit die Breite 0; der Text mit `white-space:nowrap` fliesst nach rechts aus dem Element heraus. Das `translate(-50%,-50%)` bezieht sich auf diese Breite 0 und verschiebt daher nichts horizontal – der Name steht rechts vom Ankerpunkt statt darüber.

## Umsetzung
1. `labelIcon` in `src/components/maps/warn-map.tsx`:
   - Inneres Element auf `display:inline-block; width:max-content` umstellen (bzw. `position:absolute; left:0; top:0; transform:translate(-50%,-50%)`), damit die Verschiebung um die tatsächliche Textbreite erfolgt und der Name mittig über dem Ankerpunkt sitzt.
   - Schriftgrössen reduzieren: gewarnte Gemeinden 14 → 12 px, ungewarnte 13 → 11 px; Halo/Textschatten leicht anpassen, damit die Lesbarkeit bei kleinerer Schrift erhalten bleibt.
2. Ankerpunkt bleibt der bestehende „Pole of Inaccessibility“ (`labelPoint`) – dieser liegt bereits innerhalb der Fläche; mit der korrigierten Zentrierung sitzt der Text nun symmetrisch darum.
3. Prüfung im Browser (Playwright-Screenshot der Route `/karten/warnungen`, Desktop und schmale Breite), ob alle Namen innerhalb ihrer Gemeinde liegen und lesbar bleiben.
