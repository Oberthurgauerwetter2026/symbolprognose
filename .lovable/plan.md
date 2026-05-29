## Befund

Die ICON-CH1/CH2-EPS-GRIBs sind auf dem nativen Dreiecksgitter (`unstructured_grid`) und enthalten **keine** eingebetteten Koordinaten — nur Werte. MeteoSchweiz liefert die Gitterkoordinaten separat als Collection-Asset:

- `ch.meteoschweiz.ogd-forecasting-icon-ch1` → Asset `horizontal_constants_icon-ch1-eps.grib2` (CLAT/CLON für 1'147'980 Punkte)
- `ch.meteoschweiz.ogd-forecasting-icon-ch2` → Asset `horizontal_constants_icon-ch2-eps.grib2` (für 283'876 Punkte)

Die Asset-URLs sind signiert (`Expires=...`), müssen also pro Lauf frisch aus dem STAC-Collection-Endpoint geholt werden.

## Plan

1. **Neue Funktion `_load_horizontal_grid(model)` in `scripts/ingest_icon_eps.py`**
   - GET `https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-forecasting-icon-<model>`
   - Asset `horizontal_constants_icon-<model>-eps.grib2` → signierte URL extrahieren
   - GRIB herunterladen, mit pygrib öffnen, die zwei Messages `CLAT` (shortName `clat`, Einheit rad) und `CLON` (`clon`, rad) lesen
   - In Grad umrechnen (`np.degrees`), als `np.float32`-1D-Arrays cachen
   - Rückgabe `(lats, lons)`, Länge == `numberOfDataPoints` der Forecast-GRIBs

2. **Prozess-Cache pro Modell**
   - Modulvariable `_GRID_CACHE: dict[str, tuple[np.ndarray, np.ndarray]]`
   - Nur einmal pro Ingest-Lauf laden, danach wiederverwenden

3. **`_open_grib_messages` anpassen**
   - Parameter `model: str` durchreichen
   - Wenn `gridType == "unstructured_grid"` und keine eingebetteten Lat/Lon: `lats, lons = _load_horizontal_grid(model)`
   - Längenprüfung gegen `values.size`; bei Mismatch klarer Fehler
   - Den bisherigen Skip-Pfad (mit `[diag] need external grid file`) durch diesen erfolgreichen Pfad ersetzen
   - `_LAT_KEYS`/`_LON_KEYS`-Versuche und das `_GRID_DIAG_SEEN`-Set können bleiben als Fallback für künftige Edge Cases

4. **Aufrufer durchreichen**
   - In `_read_member_field` / `_fetch_step` (oder wo auch immer `_open_grib_messages` aufgerufen wird) das `model`-Kürzel mitgeben

5. **Validierung**
   - Nächster Workflow-Lauf sollte `[grid] loaded ch1 grid: 1147980 points` zeigen, dann `members=21` pro Horizont und ein veröffentlichtes Manifest

### Technische Notizen
- CLAT/CLON liegen in Radiant vor → `np.degrees(...)` zwingend
- Asset-URL ist signiert; nicht cachen über Läufe hinweg, sondern jedes Mal frisch aus STAC holen
- Keine Änderungen an R2-Struktur, Manifest-Schema, Frontend, Workflow oder Timeouts
- Resampler bleibt unverändert (verarbeitet 1D Lat/Lon/Values)
