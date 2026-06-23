# Play/Scrub: Desktop flüssig machen, ohne zu glätten

## Ursache

Beim Play läuft `progress` (0…1) pro `requestAnimationFrame` weiter und triggert in **Radar** (`src/components/maps/radar-map.tsx`, Effect Z. 587-589) und **Wind-Color-Overlay** (`src/components/maps/wind-map.tsx`, Effect Z. 486-488) bei jedem RAF ein vollständiges Pixel-Repaint:

- Radar Forecast: `STEP=1`, pro Pixel bilineare Sample-Calls plus ~6× fBm (5 Oktaven) → bei Desktop-Viewport (z. B. 1700×1000 ≈ 1.7 Mio Pixel) ein Vielfaches der Mobile-Last
- Wind: `STEP=1`, pro Pixel `containerPointToLatLng` + bilinearer Sampler
- nur in der prognose. die messung ist niocht betroffen

Auf Mobile reicht der kleine Viewport, damit das pro Frame durchläuft. Auf Desktop frisst es das Frame-Budget → Stocken beim Play und Scrubbing.

Der `progress`-Wert wird ausschliesslich für eine zeitliche Lerp-Überblendung zwischen `frame` und `nextFrame` benutzt. Diese Überblendung ist genau die „Glättung", die laut Anforderung **nicht** verbessert werden soll.

## Änderungen

### 1) Radar (`src/components/maps/radar-map.tsx`)

- `PrecipOverlay`-Redraw nur noch bei `frame`/`payload`-Wechsel (Effect-Deps: `[frame, payload]`), `nextFrame` und `progress` aus den Deps entfernen.
- Im `redrawRef.current`-Body die Inter-Frame-Lerp entfernen: `vals`/`snowVals` direkt aus `frame` zeichnen, `nextVals`/`nextSnowVals`/`tRaw`/`t`/`lerp` streichen. Smoothstep-Easing entfällt.
- `progress`-State und `setProgress`-Aufrufe im Play-Loop entfernen (`progressRef` bleibt intern für das Step-Timing). `nextFrame`/`blendNext` werden nicht mehr an `PrecipOverlay` weitergereicht — Prop-Schnittstelle entsprechend kürzen.
- Effekt: pro Step genau ein Repaint statt ~60/s. Übergänge bleiben hart (kein Glätten), Step-Cadence (5 min Messung / 15 min Forecast ≤+24 h / 1 h darüber) unverändert.

### 2) Wind-Color-Overlay (`src/components/maps/wind-map.tsx`)

- `WindColorOverlay`-Redraw-Effect (Z. 486-488) Deps auf `[frame, opacity, payload]` reduzieren, `nextFrame`/`progress` raus.
- Im `redrawRef.current` `makeSampler(...)` ohne `nextFrame`/`progress` aufrufen (intern auf `progress=0` mappen, sodass nur `frame` gezeichnet wird).
- Partikel-Layer bleibt unverändert (eigener RAF-Loop, kein Pixel-Grid-Repaint).

### 3) Play-Loop-Aufräumung

- Radar Play-Loop (Z. 1227-1271): `setProgress`-Aufrufe entfernen, `progressRef` bleibt zur Step-Fortschaltung. Cadence/Cursor-Logik unverändert.
- Wind Play-Loop (`wind-map.tsx` Z. 1090-1141): analog `setProgress` entfernen, `progressRef` behält Step-Timing. Stündliche Frames bleiben wie zuletzt implementiert.

### 4) Was bewusst NICHT geändert wird

- Keine zusätzliche Glättung, Easing, Crossfade oder Bewegungsblur.
- Keine Veränderung an Farben, Iso-Bändern, fBm-Noise, Partikelmenge oder Step-Cadence.
- Keine Layout-/UI-Änderungen, kein Scrubbing-Verhalten ändern (Scrubbing setzt direkt `idx` → genau ein Repaint pro Slider-Bewegung, wird durch die Dep-Reduktion ebenfalls leichter).

## Prüfung

- Desktop: Play starten, sichtbar prüfen, dass Zeitanzeige in den definierten Schritten weiterläuft und der Canvas nicht ruckelt.
- Scrubbing am Desktop: Slider zügig bewegen, Repaint pro Step ohne Hänger.
- Mobile: Verhalten unverändert.
- Wind: Play läuft im 1-h-Takt, Color-Layer wechselt hart pro Stunde, Partikel laufen weiter flüssig.