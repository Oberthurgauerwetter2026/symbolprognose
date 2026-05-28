## Entfernung Blitzortung.org Live-Overlay

### Hintergrund
Die Blitzortung.org-Live-Daten sind lizenzrechtlich nur für rein nicht-kommerzielle/private Nutzung zulässig. Da die Website kommerziell (non-profit) betrieben wird, muss das aktuelle Overlay aus rechtlichen Gründen entfernt werden.

### Vorgehen
1. **`src/components/maps/radar-map.tsx` – Hook & Layer aufräumen**
   - Importe entfernen: `useLightning`, `LightningLayer`, `Zap`
   - State `showLightning` und `LIGHTNING_BBOX` / `LIGHTNING_WINDOW_MIN` entfernen
   - Aufruf `useLightning(enabled, bbox, windowMin)` entfernen
   - Conditional-Rendering des `<LightningLayer>` entfernen
   - "Blitze"-Toggle-Button aus der Sekundär-Toolbar entfernen
   - Blitzortung-Attribution-Zeile im Quellen-Block entfernen

2. **`src/hooks/use-lightning.ts` – Datei entfernen**
   - Der Hook wird nicht mehr benötigt und nur die Blitzortung-Quelle nutzen. Löschen.

3. **`src/components/maps/lightning-layer.tsx` – Datei entfernen**
   - Canvas-Layer-Komponente wird nicht mehr benötigt. Löschen.

4. **Build validieren**
   - Vite-Build prüfen, dass keine Import-Fehler verbleiben.

### Was bleibt erhalten
- MeteoSchweiz-Radar (WMS-Rohbilder / Nowcast)
- Hagel-Layer (POH)
- Lokalprognose (ICON-CH1)
- Alle Steuerelemente außer dem Blitze-Toggle

### Keine neue Features
Reine Entfernung ohne Ersatz oder neue Lizenzquelle.