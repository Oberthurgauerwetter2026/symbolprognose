# Artefakte in Niederschlagsflächen — Ursache & Fix

## Ursache

Beide PNG-Rasterer (`scripts/ingest_radar.py::render_png` für Messung, `scripts/ingest_openmeteo.py::_render_frame_png` für Prognose) mappen die mm/h-Werte per einfachem Threshold-Vergleich pixelweise auf Farben:

```python
for thresh, color in scale:
    mask = (values >= thresh)
    rgba[mask] = color
```

Es findet **keine räumliche Bereinigung** statt. In Kombination mit
- Nearest-Neighbour-Reprojektion der MCH-CombiPrecip-Kacheln auf das WGS84-Ausgabegrid (`sample_to_bbox`), die vereinzelte Native-Pixel isoliert stehen lässt,
- dem groben ICON-CH1-Grid (`n_lat × n_lon` ~1 km) mit numerischem Rauschen um Schwellwerte herum,

entstehen an genau den Klassen-Übergängen (0.1 / 0.3 / 0.8 / 2.0 … mm/h) einzelne "Sprenkel"-Pixel, kleine Quadrate und winzige Löcher innerhalb geschlossener Flächen. Das ist keine Konturglättungs-Frage — die Artefakte sind echte Pixel im PNG.

## Fix (nur an der Quelle, kein Blur/Crossfade/Konturglättung)

Morphologische Bereinigung des **Werte-Arrays vor** dem Farb-Mapping, angewendet je Intensitätsband. Damit:
- verschwinden isolierte Einzelpixel und kleine Inseln (< N Pixel),
- werden winzige Löcher (< N Pixel) innerhalb zusammenhängender Flächen aufgefüllt,
- bleiben Kontur, Auflösung und Farbskala unverändert (kein Weichzeichnen, keine Interpolation),
- bleibt die Klassifikation deterministisch.

### Algorithmus (identisch in beiden Skripten)

Neue Hilfsfunktion `clean_precip_field(values, min_area_px, hole_area_px)`:

1. Für jede Schwelle `t` in `PRECIP_SCALE` (aufsteigend):
   - `mask = (values >= t)` (NaN ausgeschlossen).
   - **Small-object-Removal**: Connected-Components auf `mask` (4-Konnektivität). Komponenten mit Fläche `< min_area_px` werden aus der Maske entfernt und der Wert an diesen Pixeln auf den nächst-tieferen Klassen-Schwellwert (bzw. `NaN`/0 unterhalb der untersten Klasse) zurückgesetzt.
   - **Hole-Filling**: Komponenten der invertierten Maske (Löcher innerhalb der Fläche) mit Fläche `< hole_area_px`, die vom "positiven" Bereich umschlossen sind, werden gefüllt (Wert auf `t` angehoben).
2. Ergebnis-Array geht unverändert in das bestehende `for thresh, color in scale: rgba[mask] = color`-Mapping. Kein Alpha-Blending, keine Kantenglättung.

Connected-Components ohne SciPy-Abhängigkeit: eigene Flood-Fill-Implementierung mit NumPy + iterativem Stack (klein, ~40 Zeilen), damit `scripts/requirements.txt` nicht erweitert werden muss. Alternativ `scipy.ndimage.label` — dann `scipy` in `requirements.txt` ergänzen. Vorzugsvariante: **eigene 4-Konnektivitäts-Labelling-Funktion** in einem neuen Modul `scripts/_morph.py`, das beide Skripte importieren.

### Parameter (Startwerte, konservativ)

- Messung (`ingest_radar.py`, ~500 × 300 px Ausgabegrid): `min_area_px = 4`, `hole_area_px = 4`.
- Prognose (`ingest_openmeteo.py`, ~36 × 22 px Grid): `min_area_px = 2`, `hole_area_px = 2` (Grid ist viel gröber; höhere Werte würden echte Zellen löschen).

Werte sind isoliert konfigurierbar, damit sie bei Bedarf pro Skript nachgezogen werden können.

## Änderungen

- **Neu**: `scripts/_morph.py` — 4-Konnektivitäts-Labelling + `clean_precip_field(values, scale, min_area_px, hole_area_px) -> np.ndarray` (arbeitet band-weise wie oben beschrieben).
- **Edit**: `scripts/ingest_radar.py`
  - `render_png(values, scale)` ruft vor dem Farb-Mapping `values = clean_precip_field(values, scale, 4, 4)`.
- **Edit**: `scripts/ingest_openmeteo.py`
  - `_render_frame_png(...)` ruft vor dem Farb-Mapping `arr = clean_precip_field(arr, PRECIP_SCALE, 2, 2)`.

Keine Änderungen an Frontend, Farbskalen, Manifesten, Cache oder Server-Funktionen. Nächster Ingest-Lauf (GitHub-Actions-Workflows `radar-ingest.yml` und `openmeteo-ingest.yml`) produziert bereinigte PNGs; alte werden im normalen Retention-Zyklus ersetzt.

## Verifikation

1. `python -c "from scripts._morph import clean_precip_field; ..."` mit synthetischem Array (einzelner Speckle + kleines Loch) — beides muss entfernt/gefüllt werden.
2. Workflow `radar-ingest.yml` manuell auslösen, ein Messungs-Frame in `/karten/radar` prüfen: keine Einzelpixel/Sprenkel mehr, Konturen sonst identisch.
3. Workflow `openmeteo-ingest.yml` manuell auslösen, ein Prognose-Frame prüfen: Blöcke sind zusammenhängend, keine isolierten 1-Pixel-Quadrate.
