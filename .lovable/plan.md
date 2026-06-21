# Niederschlag transparenter & Ortenetz im Oberthurgau verdichten

## 1. Radar-Karte: Niederschlag transparenter

`src/components/maps/radar-map.tsx` — `opacityVal` (aktuell `0.75`, Zeile 1155) auf **`0.60`** senken. Wirkt sowohl auf das `PrecipOverlay` (Canvas, ICON-Forecast) als auch auf das `ImageOverlay` mit den MeteoSchweiz-PNGs.

Hageldots (`0.8`, Zeile 1193) bleiben unverändert — sie sind ohnehin selten und sollen weiterhin auffallen.

## 2. Mehr Orte beim Reinzoomen — auf Radar, Wind, Niederschlagssumme

Heute existieren drei nahezu identische Listen (`RADAR_CITIES`, `WIND_CITIES`, `CITIES` in `precip-accum-map.tsx`) mit 19 Orten in drei Zoomstufen (10.5 / 11.5 / 12.5). Die Region Oberthurgau umfasst aber **21 Gemeinden** plus zahlreiche Ortsteile/Weiler — und davon ist aktuell nur ein Teil als Marker hinterlegt.

### Vorgehen

1. **Eine zentrale Quelle** für Ortsnamen anlegen: `src/data/oberthurgau-places.ts`
   ```ts
   export type Place = { name: string; lat: number; lon: number; minZoom?: number };
   export const OBERTHURGAU_PLACES: Place[] = [ ... ];
   ```
   Alle drei Map-Komponenten importieren diese Liste statt eigene Arrays zu pflegen.

2. **Liste vollständig befüllen** — nur Punkte **innerhalb des Region-Polygons** (`src/data/region.json`, 21 Gemeinden). Ablauf bei der Umsetzung:
   - **Tier A (zoom ≥ 10.5)** — alle 21 Gemeinde-Hauptorte, inkl. der bisher fehlenden **Hohentannen** und **Altnau**.
   - **Tier B (zoom ≥ 12)** — grössere Ortsteile/Fraktionen: Neukirch (Egnach), Steinebrunn, Winden, Hagenwil bei Amriswil, Schocherswil, Mauren, Birwinken-Rand-Weiler, Hefenhofen-Heldswil, Sitterdorf, Zihlschlacht, Gottshaus, Sulgen-Rand etc.
   - **Tier C (zoom ≥ 13)** — kleinere Weiler/Höfe-Cluster aus OSM (`place=hamlet`/`place=isolated_dwelling`/`place=suburb`), via Overpass-API innerhalb der Region-Polygone abgefragt und ins File gepinnt (keine Laufzeit-API-Calls).
   - **Tier D (zoom ≥ 14)** — sehr kleine Weiler, sodass beim weiteren Reinzoomen sukzessive mehr Beschriftungen erscheinen.

3. **Filter "nur Oberthurgau"**: Beim Aufbau der Liste jeder Kandidatpunkt per Point-in-Polygon gegen `region.json` prüfen. Punkte ausserhalb (z. B. Sulgen-Zentrum, Berg TG, Kreuzlingen, Münchwilen) werden verworfen.

4. **Render-Logik unverändert** — die bestehenden `ZoomGate`/`CityMarkers`-Wrapper nutzen weiterhin `minZoom` pro Eintrag, sodass beim Reinzoomen automatisch dichter wird. Keine Layout-/Icon-Änderungen.

5. **Konsistenz**: identische Liste & identische `minZoom`-Werte in allen drei Karten — eine Quelle, drei Imports.

## Technische Details

- Datei neu: `src/data/oberthurgau-places.ts` (statisches Array, ~80–120 Einträge).
- Bearbeitet: `src/components/maps/radar-map.tsx`, `wind-map.tsx`, `precip-accum-map.tsx` — lokale Arrays löschen, Import setzen, `RADAR_CITIES`/`WIND_CITIES`/`CITIES`-Verwendung durch `OBERTHURGAU_PLACES` ersetzen.
- Radar-`opacityVal`: `0.75` → `0.60`.
- Keine Änderungen an Backend, Datenfetching, Layoutkomponenten, Tooltips oder Embeds.

## Verifikation

- Build/TypeCheck grün.
- Radar-Karte: PNG-Niederschlag deutlich durchscheinender, Gemeinde-Outlines & Marker lesbar.
- Auf allen drei Karten: bei Zoom 10–11 nur Hauptorte, bei Zoom 12–14 sukzessive mehr Ortsteile, alle innerhalb der Region-Outline.
