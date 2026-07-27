Ziel: Die Orts-/Gemeindenamen auf der Warnkarte kleiner darstellen.

Befund:
- In `src/components/maps/warn-map.tsx` werden die Labels über `labelIcon(...)` gerendert.
- Aktuelle Schriftgrössen: `12 px` für gewarnte Gemeinden, `11 px` für ungewarnte Gemeinden.

Geplante Änderung:
- `src/components/maps/warn-map.tsx`:
  - In `labelIcon` die Schriftgrössen reduzieren, z. B. auf `10 px` (gewarnt) und `9 px` (ungewarnt).
  - Optional das Text-Halo (Schatten) leicht anpassen, damit die kleineren Schriften weiterhin gut lesbar bleiben.

Validierung:
- Build/Vite durchlaufen lassen.
- Kurzer visueller Check der Warnkarte, ob die Labels kleiner und nicht mehr dominierend wirken.