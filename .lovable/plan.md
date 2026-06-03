## Hintergrundkreis für Wetter-Icons auf der Karte

**Ziel:** Die Wetter-Icons in der Leaflet-Karte (`/karten/region`) besser sichtbar machen, indem jeder Icon einen kleinen, kontrastreichen Hintergrundkreis erhält.

### Änderungen
1. **`src/components/region-map.tsx`** — Im `WeatherIcon`-Wrapper (innerhalb des `divIcon`-HTML-Strings) einen zusätzlichen `<div>` als Hintergrundkreis hinzufügen:
   - Kreis hinter dem Icon, zentriert
   - Helle oder halbtransparente Füllfarbe (z. B. `rgba(255,255,255,0.85)` oder passend zum Design-Token-System)
   - Leichter Schatten oder Rand, damit er vom Kartenhintergrund abhebt
   - Z-Index so, dass der Kreis hinter dem Icon selbst liegt
2. **Keine anderen visuellen Änderungen** — Drop-Shadow und Icon-Größe (69 px) bleiben wie zuletzt eingestellt.

### Test
Nach der Änderung prüfen, ob die Icons auf verschiedenen Kartenhintergründen (Satellit, Terrain, Standard) gut lesbar sind.

---
Soll ich den Hintergrundkreis implementieren?