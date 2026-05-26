## Timeline-Panel umgestalten

**Datei:** `src/components/maps/radar-map.tsx` (MeteoTimeline-Komponente)

### Änderungen

1. **Hintergrund auf Weiss**
   - Panel-Container: `bg-[#1a1f24]` → `bg-white` mit dezentem Schatten (`shadow-lg`) und feinem Rand (`border border-neutral-200`)
   - Textfarben anpassen: weisser/heller Text → `text-neutral-900` (Hauptlabels), `text-neutral-500` (Stunden, Sekundär), `text-neutral-700` (Datum)
   - Vertikale Day-Break-Linien: hell → `bg-neutral-200`
   - Aktive Handle-Linie: weiss → `bg-neutral-900`
   - Time-Bubble: weiterhin in `BRAND`-Blau mit weisser Schrift (Kontrast)
   - Buttons (Play, Prev/Next, „Jetzt", Speed-Pills, Hagel-Toggle): Stil wie der bestehende Region-Button — weisser Hintergrund, dünner grauer Rand, aktiver Zustand in `BRAND`-Blau

2. **Slider deutlich schlanker**
   - Gesamthöhe Panel reduzieren (padding `py-3` → `py-2`, innere Abstände straffen)
   - Track-Höhe reduzieren (z. B. `h-[2px]` statt aktueller Dicke)
   - Stundenlabels kleiner (`text-[10px]`) und näher am Track
   - Day-Label-Zeile kompakter, „Aktualisiert am"-Footer in eine Zeile mit kleinerer Schrift
   - Handle-Bubble kompakter (kleinerer Padding, `text-xs`)
   - Sekundär-Toolbar (Speed, Hagel) in eine Reihe mit den Play-Controls statt eigene Zeile, wenn Platz reicht

### Nicht geändert
- Logik (Frames, Play/Pause, Geschwindigkeit, Hagel-Toggle, Datenquellen, BBox)
- Kartenkomponente selbst
