## Punkt 2 — Romanshorn-Marker (mobil)

Aktuell: `markerLonOffset: 0.012` in `src/data/spots.ts`. Auf schmalen Viewports überlappt die Pille trotzdem mit Amriswil.

Änderung in `src/data/spots.ts`:
- Romanshorn: `markerLatOffset: 0.012` (leicht nach Norden, in den Bodensee Richtung Wasser) **und** `markerLonOffset: 0.022` (etwas weiter nach Osten Richtung Egnach).

Der Marker-Anchor wandert dadurch klar aus der Amriswil-Pille heraus, die Pille selbst landet sichtbar in der Seebucht. Der eigentliche Forecast-Punkt (lat/lon) bleibt unverändert, nur die Anzeige verschiebt sich (siehe Kommentar im `Spot`-Typ).

Wirkung: betrifft Region-Karte (`region-map.tsx`) und SVG-Snapshot — beide nutzen `markerLatOffset` / `markerLonOffset` bzw. den Spot direkt.

---

## Punkt 1 — Externer Monitor zeigt nur blauen Hintergrund

Die TV-Seite https://www.oberthurgauerwetter.ch/tagesprognose-post-obt/ bettet eines unserer Embeds (vermutlich `/embed/lokal` oder `/embed/region-lokal`) per iframe in WordPress ein. Auf dem Foto:

- Browser fragt nach Proxy-Login (`outproxy3.pnet.ch:3128`) → wird typischerweise abgebrochen → der Browser blockiert dann sämtliche Origin-Requests des iframes inkl. JS-Bundle, Tiles und Server-Funktionen.
- Übrig bleibt nur das, was der HTML-Server in der ersten Antwort liefert: bei `/embed/lokal` ist das aktuell ein `<EmbedShell>` mit einem hellen Hintergrund — der `<noscript>`-Fallback wird vom proxy-blockierten Browser nicht zwingend gezeigt (er führt JS aus, aber lädt das Bundle nicht), darum bleibt die Fläche leer/blau.

### Plan

1. **Identifizieren, welches Embed eingebunden ist** — kurz `view-source:` der WP-Seite gedanklich prüfen (Plan beschreibt nur die Annahme); falls beide Embeds in Frage kommen, beide Routen anpassen: `/embed/lokal`, `/embed/region-lokal`, optional `/embed/region` und `/embed/all`.

2. **SSR-Fallback statt nur `<noscript>`** — in den Embed-Routen den `LokalNoscript`/`RegionLokalNoscript` zusätzlich *sichtbar* hinter dem React-Widget rendern und erst per JS verstecken, sobald die Hydration läuft und Daten da sind:
   - Server liefert vollständig gerenderten Fallback (Text + statische Werte aus `buildLokalNoscriptData`) in das HTML.
   - Ein kleines Inline-Script setzt eine Klasse `html.js-ok` o.ä. — nur dann blendet CSS den Fallback aus und das interaktive Widget ein.
   - Wenn JS/Bundle blockiert ist, bleibt der Fallback sichtbar (kein blauer Leerraum).

3. **Hintergrundfarbe der `EmbedShell` neutralisieren**, damit ein evtl. weiterhin leerer State nicht als „blaue Fläche" wahrgenommen wird — `EmbedShell` aktuell ohne `bg-*`, aber Tailwind-Theme im iframe nutzt `--background`. Hintergrund explizit auf `bg-background text-foreground` setzen.

4. **Minimal-CSS für Fallback** in `src/styles.css`: `.embed-fallback { display: block } html.js-ok .embed-fallback { display: none } .embed-live { display: none } html.js-ok .embed-live { display: block }`.

5. **Optional**: Bei `/embed/lokal` und `/embed/region-lokal` zusätzlich ein `<meta http-equiv="refresh" content="900">` für TV-Display einbauen, damit der Browser den Fallback alle 15 min neu zieht und so neue Daten bekommt, falls JS dauerhaft blockiert.

### Technische Details

Dateien:
- `src/data/spots.ts` — Romanshorn-Offset.
- `src/routes/embed.lokal.tsx`, `src/routes/embed.region-lokal.tsx` (ggf. `embed.region.tsx`, `embed.all.tsx`) — Fallback in JSX-Baum aufnehmen, Klassen `embed-fallback` / `embed-live` vergeben.
- `src/components/embed-shell.tsx` — Hintergrund explizit setzen, `<script>{`document.documentElement.classList.add('js-ok')`}</script>` im Mount (`useEffect`) oder besser direkt als Inline-Script im `__root.tsx`-Head für Embed-Routen.
- `src/styles.css` — neue Utility-Klassen.

Nicht angefasst: Datenpipeline, MapTabs, Region-Map-Logik, Radar/Niederschlag.
