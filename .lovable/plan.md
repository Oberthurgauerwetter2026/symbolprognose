## Diagnose

EUMETView WMS ist tile-basiert: pro Frame fragt Leaflet ~4–9 separate Tiles à 512 px an, jede wird serverseitig live gerendert (HRFI ist langsam). Bei 18 Frames sind das schnell 70–160 Anfragen — das ist die Hauptlatenz, nicht die Bandbreite.

Méteociel ist schnell, weil sie **pro Frame genau ein vorgerendertes PNG** der ganzen Region zeigen — keine Tiles, kein Live-Render pro Kachel.

## Lösung: Single-Image-Frames + Vorab-Caching

Wir wechseln von `L.tileLayer.wms` auf **ein `ImageOverlay` pro Frame** (genau ein WMS `GetMap`-Request pro Zeitstempel, der den ganzen Region-Bbox abdeckt). Dazu kommt ein dünner Server-Proxy mit Cache, damit identische Frames nur einmal gerendert werden.

### Änderungen

**1. `src/routes/api/public/satellite/frame.ts`** (neu)
- GET-Handler, Query: `layer`, `time`, `bbox`, `w`, `h`.
- Validiert `layer` gegen Whitelist (nur die 4 Region-Layer + Fallbacks) → kein SSRF/Offene-Proxy-Lücke.
- Baut die WMS-URL gegen `view.eumetsat.int/geoserver/wms` mit `service=WMS&version=1.3.0&request=GetMap&format=image/jpeg&styles=&crs=EPSG:3857&...`.
- Streamt das Bild zurück mit `Cache-Control: public, max-age=600, s-maxage=3600, immutable` und passenden CORS-Headern. Cloudflare cached die Antwort am Edge → ab dem zweiten Nutzer kommt das Bild aus CDN-RAM.
- Setzt sinnvollen `Content-Type` aus Upstream.

**2. `src/components/maps/satellite-map.tsx`**
- `FrameStack` neu: statt `L.tileLayer.wms` pro Frame ein `L.imageOverlay` über die Region-Bbox.
  - Bbox aus Region-Definition (siehe Punkt 3).
  - Bildgrösse: an Container-Pixelgrösse angepasst (z. B. `ceil(w*dpr)` × `ceil(h*dpr)`, capped bei 1600 px Längskante).
  - `src` zeigt auf unseren Proxy: `/api/public/satellite/frame?layer=…&time=…&bbox=…&w=…&h=…`.
  - Frame-Wechsel = nur `opacity`-Toggle (wie heute), kein Reload.
- Radial-Preload bleibt; statt `L.tileLayer.wms.on('load')` hängen wir an das `<img>`-`onload` des Overlays.
- Da nur 1 Request pro Frame ankommt, fällt die `tileerror`-Fallback-Logik schlanker aus: bei `error` auf `<img>` einmal mit `fallbackLayer` retry.
- Da Zoom fix ist, sind Container-Grösse und Bbox stabil → kein Re-Request bei Resize, ausser tatsächlicher Container-Wechsel (Vollbild). Bei Vollbild Bild-URL einmal neu rechnen.

**3. `src/lib/satellite.functions.ts`**
- `SatelliteRegion` erhält `bbox: [west, south, east, north]` (EPSG:4326). Werte pro Region:
  - `alpen-ch`: `[5.5, 45.5, 11.5, 48.0]`
  - `europa-geocolour` / `europa-ir`: `[-15, 35, 35, 65]`
  - `global-ir`: `[-180, -60, 180, 75]`
- Manifest exportiert `bbox` mit, Client liest es.
- Frame-Fenster bleibt: 3 h HRFI, 5 h Global.

**4. Performance-Feinjustierung**
- HRFI-Frame-Anzahl auf moderate 12 (Step 15 min, 3 h) reduzieren — der Loop bleibt flüssig, halbiert aber Latenz beim Erstaufbau gegenüber 18 × 10 min.
  - Konkret: `stepMinutes` bei `alpen-ch` von 10 → 15.
- Initial-Render: nur der aktive Frame blockiert die „Ready"-Schwelle; restliche Frames laden weiter im Hintergrund (heute schon so, bleibt).
- `ready`-Schwelle auf **aktiver Frame geladen** ändern (statt 80 % aller Frames) → User sieht Bild + Play-Button viel früher.

### Erwartete Wirkung

- 1 Request statt 4–9 pro Frame → ~5–8× weniger Round-Trips.
- Edge-Cache fängt wiederholte Anfragen ab → zweiter Aufruf praktisch instant.
- `ready` wird sichtbar, sobald ein einziges Bild da ist, nicht erst nach ~14 Bildern.

### Nicht-Ziele
- Keine Änderung an UI-Layout, Slider, Region-Switch.
- Kein eigener R2-Cache (Edge-Cache reicht; R2 wäre nächster Schritt, falls nicht genug).
- Embed-Pfad bleibt unverändert.

## Dateien
- neu: `src/routes/api/public/satellite/frame.ts`
- edit: `src/lib/satellite.functions.ts` (bbox, stepMinutes, ready-Logik im Client koordinieren via Manifest)
- edit: `src/components/maps/satellite-map.tsx` (ImageOverlay-Stack, ready=erster Frame)
