## 1. Warnfenster (Info-Panel) – grössere Texte
`src/components/maps/warn-map.tsx`, Bereich Info-Panel (ca. Zeilen 443–515):
- Überschrift „Region Oberthurgau“ / Gemeindename von `text-base` auf `text-lg`.
- Warnungs-Kopfzeile (farbiger Balken mit Titel) von `text-sm` auf `text-base`, Icon 4→5.
- Gültigkeitszeitraum, Beschreibung, „Mögliche Auswirkungen“, „Empfohlenes Verhalten“ und Gemeindeliste von `text-sm` auf `text-base` mit `leading-relaxed`; Innenabstände leicht erhöht (p-3 → p-3.5, space-y-3 → space-y-3.5).
- „Zurzeit keine Warnungen“-Text ebenfalls auf `text-base`.
- Titel „Warnungen abonnieren“ auf `text-base`.

## 2. Banner (Gefahrenarten-Leiste) grösser
Gleiche Datei, Bereich Banner (ca. Zeilen 279–336):
- Buttons: Padding `px-3 py-2` → `px-3.5 py-2.5`, Schrift `text-xs` → `text-sm`, Icons `h-4 w-4` → `h-5 w-5`, Stufen-Badge `text-[10px]` → `text-xs`.
- Statusanzeige rechts („Höchste Stufe“ / „Keine Warnungen aktiv“) auf `text-sm`, Icons entsprechend grösser.
- Horizontales Scrollen auf schmalen Geräten bleibt erhalten.

## 3. Neue Symbole
Neue Datei `src/components/warnings/hazard-icons.tsx` mit zwei SVG-Komponenten im Lucide-Stil (24×24, `stroke="currentColor"`, `strokeWidth 2`, `className`-Prop – damit sie überall dort funktionieren, wo heute ein Lucide-Icon steht):
- `SlipperyCarIcon`: Auto in leichter Schräglage mit zwei geschwungenen Schleuderspuren darunter (Strassenglätte).
- `WindsockIcon`: Mast mit im Wind stehendem, gestreiftem Windsack (Wind).

In `src/lib/warnings-config.ts`:
- `icon: CarFront` → `SlipperyCarIcon`, `icon: Wind` → `WindsockIcon`; nicht mehr benötigte Lucide-Importe entfernen.
- Der Typ `icon` wird von `LucideIcon` auf einen kompatiblen Komponententyp (`ComponentType<{ className?: string }>`) erweitert, damit eigene SVGs erlaubt sind.

Die Symbole erscheinen dadurch automatisch überall gleich: Banner, Warnkarte, Warn-Badges in Lokal-/Symbolprognose und Admin-Tool.

## Prüfung
Screenshot der Route `/karten/warnungen` (Desktop und schmal) zur Kontrolle von Lesbarkeit, Banner-Umbruch und den beiden neuen Symbolen.
