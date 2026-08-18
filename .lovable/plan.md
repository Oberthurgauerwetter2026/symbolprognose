# Lokalprognose-Snippet 1:1 wie im Original

## Ziel

Ein WordPress-Snippet, das ausschliesslich die Lokalprognose zeigt — in genau der Darstellung wie auf der Website (/karten/lokal), also normale Abstände, 5-Tage-Kacheln mit „7 Tage“-Umschalter, Tagesbalken, Stundenverlauf und Fussleiste. Ohne Wetterboard-Rahmen (keine Sidebar, keine Kartenreiter, keine Seitenkopfzeile). Start leer mit Ortssuche; nach Ortswahl klappt die volle Prognose auf.

## Was gebaut wird

1. **Neue Embed-Route `/embed/lokalprognose`**
   - Rendert `WeatherWidget` ohne `compact`, ohne `detailOnly`, ohne `lockedLocation` — also identisch zur Original-Seite, nur ohne Seitenrahmen.
   - Optionale Suchparameter wie im Original: `day`, `lat`, `lon`, `name` (damit man das Snippet auf einen Ort vorbelegen kann, standardmässig leer mit Suche).
   - JS-freier Fallback über `LokalNoscript` (Amriswil) wie bei den bestehenden Lokal-Embeds, plus `robots: noindex` und die üblichen Embed-Cache-Header.
   - Höhe wird über `EmbedShell` per `postMessage` (`lovable-weather:height`) an den Host gemeldet.

2. **Snippet in `/embed-info`**
   - Neuer Eintrag „Lokalprognose (wie Original)“ in der Produktliste mit `variant: "auto-height"`, Starthöhe ca. 280px.
   - Nutzt den bestehenden `buildAutoHeightSnippet`, damit das iframe nach der Ortswahl weich mitwächst.
   - Hinweis, dass es in WordPress in einen Custom-HTML-Block gehört (Skript für Höhenanpassung).

Der bestehende Eintrag „Lokalprognose mit Ortssuche (Auto-Höhe)“ (kompakt) bleibt unverändert erhalten.

## Technische Hinweise

- Neue Datei: `src/routes/embed.lokalprognose.tsx` (Muster: `src/routes/embed.lokal-suche.tsx`, aber ohne `compact`).
- Anpassung: `src/routes/embed-info.tsx` — ein zusätzlicher Eintrag in `PRODUCTS`; `buildAutoHeightSnippet` erhält eine eigene iframe-ID pro Snippet, damit zwei Auto-Höhe-Snippets auf derselben WP-Seite nicht kollidieren.
- Keine Änderungen an `weather-widget.tsx`, an Datenquellen, Server-Funktionen oder der Datenbank.

## Prüfung

- `/embed/lokalprognose` im Browser öffnen: zuerst nur Suchkopf, nach Ortseingabe volle Original-Ansicht (Tageskacheln, „7 Tage“, Stundenverlauf, Fussleiste).
- Snippet in einer Test-HTML-Seite einbinden: iframe startet niedrig, wächst nach Ortswahl ohne innere Scrollbalken.
- Mobile Breite prüfen.
