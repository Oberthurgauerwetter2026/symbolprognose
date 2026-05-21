## Änderungen in `src/components/region-map.tsx`

### 1. Zoom enger, aber frei zoombar
- `bounds`-Padding von `±0.005` auf `±0.001` reduzieren → engerer Standardausschnitt.
- `boundsOptions.padding` von `[24,24]` auf `[8,8]`.
- `minZoom`/`maxZoom` werden gelockert: `minZoom={9}`, `maxZoom={17}` — Rein- und Rauszoomen bleibt voll möglich.
- `maxBounds` etwas grosszügiger (`extended.pad(0.3)`), damit das Rauszoomen nicht durch Bounds blockiert wird.

### 2. Relief-Layer von swisstopo
Über die Basiskarte zusätzlich ein halbtransparenter Relief-Layer:
- `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png`
- Als zweiter `<TileLayer opacity={0.35}>` direkt nach der Basiskarte gerendert, damit die Schummerung darüber liegt und Topografie sichtbar wird.

### 3. Aussenbereich dunkler
- `OUTSIDE_MASK` Style: `fillColor: "#5a6670"`, `fillOpacity: 0.78` (vorher `#8a96a0` / `0.7`).

### 4. Region grüner
- `REGION` Style: `fillColor: "#7ebd5a"` (kräftigeres Wiesengrün), `fillOpacity: 0.55`.
- `mouseover`/`mouseout` ebenfalls auf `0.55`.

### 5. "Bodensee"-Label entfernen
- `LAKE_LABEL_ICON` und der zugehörige `<Marker position={[47.625, 9.32]} …/>` werden entfernt.

### 6. Tageszeit-Symbolik: Sonne/Mond je nach Stunde
Aktuell zeichnet `WeatherIcon` standardmässig `isDay=true`. Künftig wird `isDay` aus `hourOfDay` abgeleitet:

- `const isDay = hourOfDay >= 6 && hourOfDay < 20;` (06–19 Uhr = Tag, sonst Nacht).
- An `MarkerPill` und `<WeatherIcon …>` durchreichen: `<WeatherIcon code={code} isDay={isDay} size={34} />`.
- `SpotMarker` erhält denselben Wert (aus `absoluteHour % 24`), damit nachts korrekt der Mond bzw. Mond+Wolke gerendert wird. `IconCloudy`, `IconFog`, `IconRain`, `IconSnow`, `IconThunderstorm` haben kein Tag/Nacht-Pendant und bleiben unverändert (entspricht der bestehenden Icon-Bibliothek).

### Schieberegler unverändert
- Bleibt im 3-h-Takt ab "jetzt", `dayIndex` rollt automatisch in den nächsten Tag (`Math.floor(absoluteHour/24)`), `MAX_STEPS = 40`. Tagesleiste bleibt klickbar als Sprungziel.

## Nicht geändert
- swisstopo Basiskarte (Leichte Basiskarte grau), See-Polygon und blaue Füllung, Marker-Layout, Region-Klick → `/`, Slider-Logik, Daten-Fetch.

## Offen
- Tag/Nacht-Grenze: aktuell 06–20 Uhr. Wenn du eine andere Grenze willst (z.B. 07–19 oder dynamisch nach Sonnenauf-/untergang aus Open-Meteo), sag Bescheid — Open-Meteo liefert `sunrise`/`sunset` pro Tag, das könnte ich pro Spot/Tag exakt rechnen.
