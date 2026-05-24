## Ziel

Kartenstil in `src/components/region-map-template.tsx` anpassen:

1. **Basiskarte wechseln**: Statt `ch.swisstopo.leichte-basiskarte` die Swisstopo **Reliefkarte** als Hauptlayer verwenden (`ch.swisstopo.pixelkarte-farbe` mit Relief, oder direkt das Reliefschattierungs-Layer `ch.swisstopo.swissalti3d-reliefschattierung_mono` als Basis auf neutralem Hintergrund). Konkret: `ch.swisstopo.pixelkarte-grau` als Basis + bestehende Reliefschattierung darüber, oder den swisstopo "Landeskarte als Relief"-Layer `ch.swisstopo.pixelkarte-farbe-pk25.noscale` — ich nehme die Kombi **leichte Basiskarte grau/relief** → Layer `ch.swisstopo.leichte-basiskarte_reliefschattierung` (offizieller Relief-Stil).
2. **Oberthurgau** bleibt grün (aktuelle `regionFillColor` `#7ebd5a`) — unverändert.
3. **Ausserhalb der Schweiz**: aktuelle graue Maske (`#5a6670`, opacity `0.6`) bleibt erhalten — sie liegt sowieso über allem ausserhalb der Region. Damit ausserhalb der **Schweizer Landesgrenze** dunkel bleibt, die Maske so anpassen, dass sie die Schweiz-Aussenform berücksichtigt (oder einfach belassen, da swisstopo-Tiles ohnehin nur CH zeigen).
4. **Kanton Thurgau leicht andeuten**: neues GeoJSON `src/data/thurgau-canton.json` (Kantonsgrenze TG) als dezenter Outline-Layer (z. B. `#2561a1` / weight `1` / opacity `0.4`, ohne Füllung) hinzufügen. Quelle: swissBOUNDARIES3D via `api3.geo.admin.ch` (Kanton Thurgau).

## Änderungen

- **`src/components/region-map-template.tsx`**
  - Neuer optionaler Prop `cantonOutline?: FeatureCollection`.
  - Basis-`TileLayer` URL ändern auf den Relief-Stil von swisstopo.
  - Bestehender Reliefschattierungs-Layer bleibt (oder wird entfernt, falls der neue Basis-Layer bereits Relief enthält — dann nur ein Layer).
  - Neuer `GeoJSON`-Layer für `cantonOutline` (nur Stroke, keine Füllung, dezent).
- **`src/data/thurgau-canton.json`** (neu) — Kantonsgrenze TG als FeatureCollection.
- **`src/components/region-map.tsx`** — `cantonOutline={thurgauCanton}` durchreichen.

## Offene Frage

Welcher swisstopo-Stil ist gemeint?

- **A**: `ch.swisstopo.pixelkarte-farbe` (farbige Landeskarte mit Relief, kräftig)
- **B**: `ch.swisstopo.leichte-basiskarte_reliefschattierung` (helle Basiskarte mit Reliefschatten, dezent)
- **C**: Nur Reliefschattierung pur (`swissalti3d-reliefschattierung`) auf neutralem Grau (sehr minimal, topografisch)

Default-Vorschlag: **B** — passt am besten zum aktuellen klaren Look und betont das Relief.
