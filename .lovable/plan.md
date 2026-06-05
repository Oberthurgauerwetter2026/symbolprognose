## Ziel

Überall in der App / in den Embeds die Quellenangabe **"Oberthurgauer Wetter"** als Primärquelle voranstellen — analog zu Radar- und Niederschlagskarte, die das bereits machen ("Quelle: Oberthurgauer Wetter · …").

## Bestand

Bereits vorhanden:
- `src/components/maps/radar-map.tsx` (Attribution & Footer)
- `src/components/maps/precip-accum-map.tsx` (Attribution)

Fehlt noch:

| Datei | Stelle |
|---|---|
| `src/components/region-map.tsx` | Z. 700 Leaflet-`attribution`; Z. 924 Footer "· Quellen: …" |
| `src/components/region-map-template.tsx` | Z. 152 Leaflet-`attribution` |
| `src/components/weather-widget.tsx` | Z. 354 "Datenstand: … · Quellen: …" |
| `src/components/embeds/lokal-noscript.tsx` | Z. 164 "Quelle: MeteoSchweiz …" |
| `src/components/embeds/radar-noscript.tsx` | Z. 120 "Quelle: MeteoSchweiz …" |

`weather-widget.tsx` Z. 1171 ("Grafik © …") bleibt unverändert — das ist eine Copyright-Zeile für die Grafik, keine Datenquelle.
`embed-shell.tsx` und `embeds/region-lokal-noscript.tsx` haben keine eigene Quellenzeile.

## Änderung (konsistentes Muster)

Überall den String so umformulieren, dass **"Oberthurgauer Wetter"** vorne steht und die Modelle als Nachsatz folgen:

- **Leaflet-Attribution** (Karten): vorne `Quelle: Oberthurgauer Wetter · ` ergänzen, bestehende swisstopo/OSM-Links unverändert dahinter belassen.
  - `region-map.tsx` Z. 700 →
    `'Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'`
  - `region-map-template.tsx` Z. 152 →
    `'Quelle: Oberthurgauer Wetter · © <a href="https://www.swisstopo.admin.ch/">swisstopo</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'`

- **Footer/Quellenzeilen** (Widgets, Embeds):
  - `weather-widget.tsx` Z. 354 →
    `Datenstand: {fmt} · Quelle: Oberthurgauer Wetter · Modelle: ICON-CH1/CH2, ECMWF IFS, DWD-MOSMIX`
  - `region-map.tsx` Z. 924 (das `·`-Suffix nach Datenstand) →
    `· Quelle: Oberthurgauer Wetter · Modelle: ICON-CH1/CH2, ECMWF IFS, DWD-MOSMIX`
  - `embeds/lokal-noscript.tsx` Z. 164 →
    `Quelle: Oberthurgauer Wetter · Modelle: MeteoSchweiz ICON-CH1/CH2 & ECMWF IFS via Open-Meteo`
  - `embeds/radar-noscript.tsx` Z. 120 →
    `Quelle: Oberthurgauer Wetter · MeteoSchweiz Radar (CPC) & ICON-CH1/CH2 via Open-Meteo`

## Nicht betroffen

- Datenabrufe, Aggregation, Server-Functions, JSON-LD-Metadaten.
- Reine Copyright-/Grafik-Hinweise.
