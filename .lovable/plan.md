## Ziel

MCH-Radarmessungen wie die Modellprognose in harten Farb­blöcken rendern (nicht mehr Leaflet-hochskaliert) und den Filmstrip exakt im geforderten Takt laufen lassen, ohne Crossfade.

## 1. MCH-Messung über Canvas mit harten Farbbändern

Aktuell wird `currentFrame.precipUrl` als `StableImageOverlay` (Leaflet `L.imageOverlay`) eingehängt — dadurch interpoliert der Browser die PNG-Pixel und das Bild wirkt beim Hineinzoomen pixelig. Die Prognose nutzt `PrecipOverlay`, das ein mm/h-Raster bilinear über das Viewport-Gitter sampelt und dann in harte `colorFor`-Bänder einfärbt. Für die Messung existiert dieselbe Pipeline bereits als `MeasurementCanvasOverlay`, sie wurde nur wegen CORS deaktiviert.

Umsetzung:

- In `src/components/maps/radar-map.tsx` den `precipUrl`-Branch (~Zeile 1744) wieder auf `MeasurementCanvasOverlay` umstellen.
- Auf Mess- und Prognose-Canvas `imageRendering: "pixelated"` und `imageSmoothingEnabled = false` setzen — keine Weichzeichnung.

## 2. Same-Origin-Proxy für die R2-PNGs

Damit `MeasurementCanvasOverlay` per `crossOrigin="anonymous"` lesen darf, ohne das Canvas zu tainten, kommt eine neue Server-Route:

- **neu** `src/routes/api/public/radar/proxy.ts` mit `GET`/`OPTIONS`-Handler. Akzeptiert nur Query-Parameter `path`, der mit `radar/` beginnt und auf `.png` endet (Allowlist). Holt die Datei über `r2ObjectUrlCandidates(...)` aus dem konfigurierten R2-Public-Host und streamt sie 1:1 mit `Content-Type: image/png`, `Cache-Control: public, max-age=3600, immutable` und permissiven CORS-Headern zurück.
- `src/lib/radar.functions.ts`: `precipUrl` und `hailUrl` im Output auf `/api/public/radar/proxy?path=...` umschreiben (nur Pfadanteil hinter dem R2-Public-Prefix übernehmen).

## 3. Crossfade / Weichmachen entfernen

- Den `nextFrame`/`blendNext`-Block (~Zeile 1601–1613) und alle `nextFrame`/`progress`-Übergaben an `PrecipOverlay` entfernen — pro Frame wird nur der aktuelle Frame gezeichnet, kein Opacity-Lerp.
- `MeasurementCanvasOverlay` setzt `opacity` direkt ohne Übergangsanimation.

## 4. Filmstrip-Cadence

`playStepIndices` (~Zeile 1516–1536) erhält die geforderte Staffelung:

- `t <= nowMs` (Messung) → **5 min**
- `nowMs < t <= nowMs + 24 h` (Prognose 0–24 h) → **15 min**
- `t > nowMs + 24 h` → **60 min**

Damit fällt der Cadence-Wechsel exakt auf „jetzt“; kein 5-min-Block mehr in der Prognose.

## Verifikation

- `bunx tsgo --noEmit`
- Preview `/karten/radar` bei Zoom 11+: MCH-Bild zeigt dieselben rechteckigen Farb­blöcke wie die Prognose, keine PNG-Quellpixel sichtbar.
- Netzwerk-Tab: PNG-Requests gehen an `/api/public/radar/proxy?path=...`.
- Play-Test: Mess-Frames im 5-min-Takt, ab erstem Forecast-Frame im 15-min-Takt, ab +24 h im 1-h-Takt; harte Wechsel ohne Fade.

## Geänderte / neue Dateien

- `src/components/maps/radar-map.tsx`
- `src/lib/radar.functions.ts`
- **neu** `src/routes/api/public/radar/proxy.ts`