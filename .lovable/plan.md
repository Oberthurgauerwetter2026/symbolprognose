## Marker-Stil: Glassmorphism minimal

### Ziel
Die Wetter-Marker-Pills auf der Regionkarte von fester blau/weißer "Block-Optik" auf einen dezenteren, halbtransparenten Glassmorphism-Stil umstellen.

### Änderungen
1. **MarkerPill-Komponente** (`src/components/region-map.tsx`, Zeile ~78–177):
   - Hintergrund: `rgba(255,255,255,0.72)` + `backdrop-filter: blur(8px)` statt fester Brand-Blau `#2561a1`
   - Border: `1px solid rgba(255,255,255,0.55)` statt kein Rand
   - Schatten: `0 1px 3px rgba(0,0,0,0.06)` (subtil) statt `0 6px 20px rgba(0,0,0,0.32)` (schwer)
   - Textfarbe: `#1e293b` (dunkel) statt `#fff` (weiß)
   - Icon: kein weißer Kreis-Hintergrund mehr, Icon direkt farbig in natürlicher Größe (22px)
   - Ortsname: `9px`, `uppercase`, `#94a3b8` (sehr dezent)
   - Temperatur: kompakt, `11–12px`, `font-weight: 600`, Min-Wert in Brand-Blau, Max-Wert in Dunkel
   - Trennzeichen bei Tagesansicht: schmaler `/` statt zwei farbigen Badges
   - Padding und Gap reduziert für kompaktere Pill

2. **Loading-State-Marker** (Zeile ~202–224):
   - Gleicher Glassmorphism-Stil statt blauem Pill

3. **CSS-Regeln in `src/styles.css`**:
   - Prüfen, ob `.region-map-pill:hover` angepasst werden muss (z. B. leichter Schatten + leichte Hebung)

### Design-Referenz
- Gewählte Richtung: "Glassmorphism minimal" aus dem Design-Directions-Tool
- Semantische Tokens aus `src/styles.css` verwenden wo möglich