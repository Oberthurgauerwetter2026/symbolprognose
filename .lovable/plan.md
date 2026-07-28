## Ziel

Die App ist ein Wetterboard mit mehreren Produkten (Warnungen, Region, Lokal, Wind, Radar, Niederschlag, Satellit). Der Name „warnkarte-oberthurgau“ passt darum nicht als Dach-URL. Neue Adresse: **https://oberthurgauerwetter.lovable.app** – jedes Produkt bekommt darunter seinen eigenen Pfad und ein eigenes WordPress-Snippet.

## 1. URL umstellen

- Projekt neu publizieren unter dem Slug `oberthurgauerwetter`.
- Alle fest verdrahteten Vorkommen von `warnkarte-oberthurgau.lovable.app` ersetzen in:
  - `src/lib/site-url.ts` (`SITE_URL`)
  - `src/routes/__root.tsx`, `src/routes/karten.warnungen.tsx` (og:url / canonical)
  - `src/routes/embed-info.tsx` (`PUBLISHED_ORIGIN`)
  - `src/routes/api/public/snapshot/$map.ts`, `src/lib/snapshot.server.ts`
  - `src/components/embeds/lokal-noscript.tsx`, `radar-noscript.tsx`
- Meta-Titel/Beschreibungen im Root auf das Board formulieren („Oberthurgauer Wetter – Warnungen, Prognosen, Radar & Satellit“), Warnkarte bleibt eigene Route mit eigenem Titel.
- PWA-Manifest: Name „Oberthurgauer Wetter“, `start_url` bleibt relativ.

Wichtig: Nach der Umbenennung ist die alte Adresse nicht mehr gültig. Die bereits eingebauten WP-Iframes müssen einmalig auf die neue Origin umgestellt werden.

## 2. Embed-Übersicht pro Produkt

`/embed-info` wird zur vollständigen Produktliste. Pro Produkt ein Abschnitt mit Beschreibung, empfohlener Höhe und fertigem Copy-Paste-Snippet:

```text
Wetterwarnungen        /embed/warnungen           760px  (inkl. Push-Hinweis-Button)
Lokalprognose Amriswil /api/public/embed/region-lokal-static  520px  (unverändert)
Wetterkarte Region     /embed/region              600px
Lokalprognose (Karte)  /embed/lokal               600px
Wind                   /embed/wind                600px
Radar                  /embed/radar               600px
Satellit               /embed/satellit            600px
Satellit Loop          /embed/satellit-loop       520px
Komplett-Board (Tabs)  /embed/all                 760px
```

- Das Amriswil-Snippet (`region-lokal-static`, `scrolling="no"`, `background:#ffffff`, `border-radius:8px`, 520 px) bleibt exakt in der bestehenden Form – nur die Domain im `src`/`preconnect` wird getauscht.
- Jeder Abschnitt bekommt Titel, Kurzbeschreibung, Höhen-Hinweis und Kopieren-Button (bestehende `SnippetBlock`-Komponente).
- Empfehlung im Text: pro Produkt eine eigene WordPress-Seite/Block, damit jedes Produkt einzeln benannt und verlinkt werden kann.

## 3. Push-Hinweis

Bleibt wie gebaut: im Iframe kein Push möglich, der Button im Warn-Embed öffnet `oberthurgauerwetter.lovable.app/karten/warnungen` in eigenem Tab, dort funktionieren Benachrichtigungen.

## Technische Details

- `getAppUrl()` in `src/lib/site-url.ts` bleibt logisch unverändert, nur die Konstante ändert sich; Preview- und Localhost-Erkennung bleiben erhalten.
- Keine DNS-/Cyon-Änderungen, kein Webhosting nötig.
- Nach dem Merge einmal publizieren, danach die neuen Snippets aus `/embed-info` in WordPress einsetzen.
