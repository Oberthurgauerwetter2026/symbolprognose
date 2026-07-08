## Diagnose
Dein Display meldet `devicePixelRatio = 1`, deshalb greift der HiDPI-Trick nicht. Wichtiger noch: MTG-FCI HRFI GeoColour hat nativ ~1–1.4 km/Pixel. Bei Zoom 8 zeigt Leaflet ~300 m/Pixel — das Bild wird also grundsätzlich ~4× hochskaliert. Keine Client-Einstellung macht daraus ein scharfes Bild; die Datenauflösung ist die harte Grenze.

## Lösungswege

### A) Supersampling erzwingen (kleiner Effekt, kostenlos)
GeoServer immer mit 2× Pixeln anfragen (nicht nur bei dpr>1) und per CSS auf Kachelgröße skalieren. Bringt etwas glattere Kanten (Server rendert mit bicubic), aber die native ~1 km-Grenze bleibt.

### B) Zoom an native Auflösung anpassen (echter Schärfegewinn)
CH-Region von Zoom 8 → 7 zurück. Bei Zoom 7 entspricht ein Kartenpixel ~600 m — nahe an nativen ~1 km, dadurch wirken Wolkenkanten scharf statt "aufgeblasen". Nachteil: Ausschnitt zeigt mehr Umgebung.

### C) Höher aufgelöste Quelle als zusätzliche Region (großer Effekt, nur tagsüber)
NASA GIBS liefert Truecolor-Satellitenbilder als WMTS in **250 m** (MODIS Terra/Aqua) bzw. **375 m** (VIIRS SNPP/NOAA-20). Update: 1×/Tag, Kachelserver stabil und frei. Ideal als neue Region "Schweiz HD (Tag, MODIS/VIIRS)" mit eigenem Manifest — keine 10-Minuten-Animation, aber ein sehr scharfes Tagesbild.
- Layer z. B. `VIIRS_NOAA20_CorrectedReflectance_TrueColor` (375 m)
- Endpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/...`
- Zeit-Parameter `TIME=YYYY-MM-DD`

### D) MTG HRV/Sandwich (mittlerer Effekt, tagsüber)
MTG FCI hat einen sichtbaren Hochauflösungskanal (~500 m). EUMETSAT-view stellt aktuell nur GeoColour bereit — keinen 500-m-RGB. Als "HD-Tag" ist Weg C überlegen.

## Empfehlung
Kombination:
1. **A umsetzen** (Supersampling immer aktiv) — allgemeine Verbesserung.
2. **B umsetzen** (CH zurück auf Zoom 7) — behebt die "Weichzeichner"-Optik bei der bestehenden GeoColour-Ansicht.
3. **C als neue Region** "Schweiz HD (Tag)" mit NASA GIBS VIIRS Truecolor — statisches Tagesbild, aber deutlich schärfer.

## Frage
- Nur A+B (schnell, keine neue Datenquelle), oder
- A+B+C (zusätzlicher HD-Tag-Layer über NASA GIBS)?