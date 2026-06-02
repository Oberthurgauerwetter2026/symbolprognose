Marker werden zu kompakten, kontraststarken Karten — solides Dunkel, fette Typografie, klare Hierarchie. Form bleibt Pill (abgerundet), Inhalt wird visuell deutlich stärker.

## Änderungen in `src/components/region-map.tsx`

**Container (Zeilen 180–197):**
- Hintergrund: solides `#0f172a` (slate-900)
- Rand: `1px solid rgba(255,255,255,0.08)` für saubere Kante
- Schatten: `0 10px 24px rgba(15,23,42,0.45), 0 2px 6px rgba(15,23,42,0.3)` — deutliche Erhebung gegen die Karte
- Border-Radius: bleibt `999` (Pill)
- Padding: leicht erhöhen auf `9px 14px 9px 10px`

**Ortsname (Zeile 217–228):**
- Farbe: `#ffffff`
- Gewicht: `700` (statt 600)
- Größe: `12`
- Letter-spacing: `0.06em`
- Uppercase bleibt

**Temperaturwerte:**
- `tNow` (hourly): `#ffffff`, `fontWeight: 800`, `fontSize: 17`
- `tMax` (daily): `fontWeight: 800`, `fontSize: 17`, Farbe weiss (`#ffffff`) — Temperatur-Tönung entfällt zugunsten von reinem Kontrast
- `tMin` (daily): `fontWeight: 700`, `fontSize: 14`, Farbe `rgba(255,255,255,0.7)`
- Trenner `/`: `rgba(255,255,255,0.35)`, `fontSize: 12`

**Aufräumen:** `tempTint`-Funktion (eingeführt im letzten Schritt) wird entfernt, da Farb-Tönung nun nicht mehr verwendet wird.

**Icon:** Größe bleibt `40`. Icons sind farbig (Sonne gelb, Wolken hell) und stehen auf dem dunklen Grund kontrastreich — keine Anpassung nötig.

Layout-Struktur (Icon links, Text-Spalte rechts) bleibt erhalten.