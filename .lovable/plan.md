## Ursache

Backend-seitig sind die Prognose-Frames bereits stündlich (Radar: `radar.functions.ts` Z. 386 `tMs += 3600_000`; Wind: `wind.functions.ts` Z. 148 dito). Was als „5-min beim Scrubben" auffällt, kommt aus dem Bubble-Label: während `dragging` rechnet `MeteoTimeline` die Bubble-Uhrzeit aus der **kontinuierlichen** Cursor-Position (`tMin + dragPct/100 * span`) statt aus der tatsächlich angezeigten Frame-Zeit. Der gerenderte Frame snappt dabei korrekt auf den nächsten Frame — nur die Anzeige suggeriert 5-min-Auflösung.

Im Radar gibt es zusätzlich Vergangenheits-Frames im 5-min-Raster (MCH-Manifest). Beim Scrubben in den Forecast-Bereich kann `idxFromClientX` theoretisch einen Past-Frame wählen, wenn dieser zeitlich näher liegt — sollte fast nie passieren, ist aber nicht garantiert.

Die „2-h"-Beobachtung im Play-Loop des Radars rührt daher, dass `hourlyIndices` bei Übergang Past→Forecast Lücken haben kann (z. B. fehlt der Stundenfilm zur „aktuellen" Stunde), wodurch der erste Sprung zwei Stunden überspringt.

Ist es möglich, die Animation mit den Ns-Felder im 5 min-Takt darzustellen wie bei MCH [https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/niederschlag.html](https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/niederschlag.html)

## Änderungen

### 1) `src/components/maps/radar-map.tsx` — Bubble während Scrub snappen

- Z. 977–982 (`handlePct` / `currentMs` / `bubbleLabel`):
  - `currentMs` während `dragPct != null` aus `times[idx]` lesen (snapped Frame-Zeit), nicht aus der kontinuierlichen Cursor-Position.
  - `handlePct` weiterhin auf `dragPct` setzen, damit der Daumen flüssig folgt — aber das Label/Frame-Time strikt auf den gewählten Frame.

### 2) `radar-map.tsx` — Scrub-Snap in Forecast strikt stündlich

- `idxFromClientX` (Z. 863–879):
  - Wenn `target > now`: Kandidaten auf Forecast-Frames (`f.source !== "radar"`) beschränken.
  - Wenn `target <= now`: bisheriges Verhalten (Nearest-of-all) — Past bleibt 5-min-präzise.

### 3) `radar-map.tsx` — `hourlyIndices` ohne Lücken am Past→Forecast-Übergang

- Z. 1177–1196: zusätzlich „aktuelle Stunde" (= letzter Past-Frame, der noch in der aktuellen Stunde liegt) einfügen, damit Play den ersten Schritt sauber +1 h macht statt +2 h.
- `nextFrame`-Lookup (Z. 1236) bleibt — funktioniert dann automatisch korrekt.

### 4) `src/components/maps/wind-map.tsx` — Bubble während Scrub snappen

- Analog zur Radar-Timeline: während Drag das Bubble-Label aus der snapped Frame-Zeit ableiten, nicht aus kontinuierlicher Position. Wind-Frames sind ohnehin nur stündlich, der Play-Loop (`cur + 1`) ist damit schon korrekt — keine weitere Änderung am Loop nötig.

### Nicht angefasst

- Backend-Frame-Erzeugung (Radar/Wind) — Cadenz ist korrekt.
- `colorFor`, Overlays, Envelope-Noise, Ingest, Forecast-Pipeline.
- Play-Geschwindigkeit (`speed`/`FRAME_MS`) bleibt unverändert.

## Erwartetes Resultat

- Scrub-Bubble zeigt im Forecast diskrete Stundenwerte (14:00 → 15:00 → 16:00).
- Scrub-Bubble zeigt in der Vergangenheit weiterhin 5-min-Schritte (MCH-Radar-Auflösung).
- Play springt im Forecast exakt stündlich, ohne 2-h-Erstschritt.
- Gilt für Radar- und Wind-Karte gleichermassen.

&nbsp;