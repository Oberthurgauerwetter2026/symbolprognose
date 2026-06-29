## Hintergrund

- Open-Meteo liefert `minutely_15` der ICON-CH1-Niederschlagsprognose stundenweise konstant aus (vier identische `:00/:15/:30/:45`-Slots pro Stunde) — bestätigt im Kommentar `radar.functions.ts` Z. 552-557. Ohne räumliche Verschiebung wirken die 15-min-Frames in der Animation deshalb wie Stundenframes (Plateau-Look).
- Die frühere „funktionierende" Version benutzte genau dafür die Wind-Advektion (`meanWindAt` + `advectField` + `advectedForecast`, Z. 562-644). Beim Aufräumen der Drift-Toggle-Schiene wird sie aktuell nicht mehr aufgerufen — daher die jetzt sichtbare stündliche Kadenz.
- Canvas-Smoothing ist an beiden Render-Stellen hart deaktiviert (`imageSmoothingEnabled = false`, Z. 711 Messung, Z. 1139 Prognose). User möchte es wieder an, aber dezenter.
- das ist die aktuelle Version, bevor publishing: bitte die Prognose im 15 min. Takt so erstellen 

## Änderungen

### 1) `src/lib/radar.functions.ts` — 15-min-Frames per Wind-Advektion

- Phase-A-Loop (Z. 664-675): an `:00`-Slots bleibt `getForecastExact(tMs)` die Quelle; an `:15/:30/:45` wird `advectedForecast(tMs)` verwendet, das aus dem `:00`-Basisfeld plus mittlerem ICON-Wind (`meanWindAt`) per Semi-Lagrangean-Backtrace die räumlich verschobenen Zellen baut. Fallback-Kette: `advectedForecast(tMs) ?? getForecastExact(tMs) ?? interpolateForecast(tMs)`.
- `interpolateForecast` bleibt reiner Lücken-Fallback.
- Diagnose-Log umstellen: pro `:00/:15/:30/:45` einmal die mittlere Verschiebung in km loggen (aus `meanWindAt` × dtSec), damit verifizierbar ist, dass sich Zellen 15-minütig bewegen — z. B.
`[radar] forecast 15-min advect (km): 17:00=0.0 17:15=4.2 17:30=8.4 17:45=12.6 18:00=0.0 …`.
- Intensitäten (mm/h) werden nicht verändert, kein Crossfade, kein Weichzeichnen — nur räumliche Migration.
- `ADVECT_SCALE`, `meanWindAt`, `advectField`, `advectedForecast` bleiben unverändert.

### 2) `src/components/maps/radar-map.tsx` — Canvas-Smoothing dezent zurück

- Messung-Render (Z. 709-713):
`ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";`
- Prognose-Render (Z. 1137-1141): gleiche Einstellung.
- Sonstige Logik (Nearest-Neighbor-Sampling beim Bilden des Offscreen-Buffers, fbm-Modulation für organische Ränder) bleibt unverändert. „Low"-Smoothing wirkt nur beim finalen `drawImage`-Upscale auf die Anzeigegrösse — Quadrate werden gebrochen, ohne dass die Werte verrechnet werden.

## Verifikation

- `bunx tsgo --noEmit` grün.
- `/karten/radar`:
  - Console-Log zeigt monoton wachsende Verschiebungs-km zwischen den `:00`-Slots — Beleg, dass Zellen sich pro 15 min sichtbar bewegen.
  - Beim Scrubben/Spielen der Prognose wandern Niederschlagsfelder alle 15 min spürbar weiter (kein Stunden-Plateau mehr).
  - Pixel-Treppen an den Zellrändern sind leicht weicher, ohne dass das Raster zu „wässrigem" Look zurückkippt.