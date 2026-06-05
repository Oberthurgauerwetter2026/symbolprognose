## Ziel

Auf der Radarkarte (`/karten/radar`) beim Reinzoomen mehr Ortsnamen im **Bezirk Oberthurgau** anzeigen — auch kleine Gemeinden und Weiler, gestaffelt wie bei OpenStreetMap (grössere Orte früher, kleinere erst weit zoomed-in).

## Aktuelles Verhalten

`src/components/maps/radar-map.tsx`:

- `RADAR_CITIES` (Z. 39–47): 7 Orte (Amriswil, Erlen, Bischofszell, Münsterlingen, Güttingen, Egnach, Horn) — Bischofszell liegt streng genommen ausserhalb Oberthurgau, bleibt aber als Anker.
- Eine einzelne `ZoomGate minZoom={10.5}` zeigt alle Marker gleichzeitig.
- **Romanshorn fehlt** vollständig.

## Änderung

In `src/components/maps/radar-map.tsx`:

1. **Typ erweitern**: `RADAR_CITIES`-Einträge erhalten optional `minZoom?: number` (Default 10.5).
2. **Liste neu aufbauen** — ausschliesslich Oberthurgau (Bezirk Arbon) + ein paar nahe Seeufer-Anker, gestaffelt nach Ortsgrösse:
  - **Tier A — ab Zoom 10.5** (Hauptorte):
   Amriswil, Romanshorn, Arbon, Horn, Münsterlingen, Egnach, Güttingen
  - **Tier B — ab Zoom 11.5** (mittelgrosse Gemeinden):  
  Roggwil,, Uttwil, Salmsach, Sommeri, Erlen, Langrickenbach
  - **Tier C — ab Zoom 12.5** (kleine Gemeinden / Ortsteile):
  Hefenhofen, Dozwil, Kesswil, Hauptwil-Gottshaus, Zihlschlacht-Sitterdorf, Bischofszell
   Koordinaten (gerundet auf 4 Dezimalstellen, Ortszentren):
  - Amriswil 47.5469 / 9.2986
  - Romanshorn 47.5667 / 9.3786
  - Arbon 47.5158 / 9.4339
  - Horn 47.4986 / 9.4470
  - Münsterlingen 47.6306 / 9.2378
  - Egnach 47.5444 / 9.3833
  - Güttingen 47.6011 / 9.2917
  - Roggwil 47.4769 / 9.3922
  - Uttwil 47.5907 / 9.3367
  - Salmsach 47.5503 / 9.3725
  - Sommeri 47.5775 / 9.3194
  - Erlen 47.5375 / 9.2378
  - Langrickenbach 47.5947 / 9.2406
  - Hefenhofen 47.5722 / 9.3289
  - Dozwil 47.5867 / 9.3047
  - Kesswil 47.6022 / 9.3217
  - Hauptwil-Gottshaus 47.4894 / 9.2806
  - Zihlschlacht-Sitterdorf 47.5158 / 9.2750
  - Bischofszell 47.4944 / 9.2389
3. **Rendering** (Z. 1141–1151): Einzelne `<ZoomGate minZoom={10.5}>` durch ein Mapping ersetzen, das pro Marker einen eigenen `<ZoomGate minZoom={c.minZoom ?? 10.5}>` rendert.

## Nicht betroffen

- Radar-/Forecast-Layer, Legende, Slider, Datenquellen, andere Karten.
- `ZoomGate`-Komponente selbst (Logik bleibt).
  &nbsp;