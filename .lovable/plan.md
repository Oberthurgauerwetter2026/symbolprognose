## Plan

### Problem 1 — Mess-Daten fehlen
Der neue `MeasurementCanvasOverlay` decodiert das CombiPrecip-PNG aus Cloudflare R2 mit `crossOrigin="anonymous"` und liest es per `getImageData` aus. Liefert R2 keinen `Access-Control-Allow-Origin`-Header, scheitert entweder das Laden oder der Canvas wird „tainted" und der Pixel-Read wirft. Resultat: keine Messung sichtbar.

Fix: PNG nicht mehr clientseitig dekodieren. Stattdessen das PNG wieder als Leaflet `ImageOverlay` zeichnen — ohne CORS-Anforderung — aber so getrimmt, dass es optisch zur Prognose passt:
- `image-rendering: auto` (Browser-Bilinear), kein `pixelated`/`crisp-edges` mehr.
- Gleiche `opacity` (0.6) wie Prognose-Canvas.
- `filter: contrast(1.1)` wie Prognose-Canvas.
- Klasse `mch-precip` entsprechend anpassen (oder neue Klasse), `MeasurementCanvasOverlay` entfernen.

Damit ist die Optik wieder konsistent (selbe Farbbänder kommen aus dem MCH-PNG ohnehin), aber ohne CORS-Risiko.

### Problem 2 — Harter Stop beim Wechsel Messung→Prognose
Beim Übergang vom letzten Mess-Frame (PNG-ImageOverlay) zum ersten Prognose-Frame (Canvas) wird der PNG-Layer unmounted und der Canvas-Layer übernimmt schlagartig — sichtbarer „Pop".

Fix: kurzer Crossfade an der Bruchstelle.
- Bei aktivem Play oder Scrub im Übergangsbereich werden für ~300 ms beide Layer parallel gerendert.
- Mess-PNG fadet von `opacity 0.6 → 0`, Prognose-Canvas von `0 → 0.6`.
- Mechanik: ein zusätzlicher `transitionState` im `RadarMap`, der bei Wechsel der Quelle (`radar` → forecast) ein kurzes RAF-Fade triggert. Die Komponenten erhalten ihren Ziel-Opacity-Wert per Prop.
- Während Auto-Play ist die Übergangs-Dauer = ein Play-Frame-Schritt, damit die Animation flüssig wirkt.

### Validierung
- `/karten/radar`: Mess-PNG erscheint wieder sofort beim Laden und beim Scrubben in der Vergangenheit.
- Play von Messung in die Prognose: kein Aufblitzen/Pop mehr, Layerwechsel ist ein weicher Crossfade.
- Mobile bleibt unverändert.
