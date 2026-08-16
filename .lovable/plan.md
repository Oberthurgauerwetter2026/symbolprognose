# Embed-Snippet: Lokalprognose mit Ortssuche und Auto-Höhe

## Ziel

Ein WordPress-Snippet für die Lokalprognose, das kompakt startet (Suchfeld sichtbar) und automatisch mitwächst, sobald ein Ort eingegeben und die Prognose aufgeklappt wird.

## Was gebaut wird

1. **Neue Embed-Route `/embed/lokal-suche`**
   - Nutzt das vollständige Widget (`WeatherWidget compact`) — also mit Suchfeld, Ortung und Ortspille — statt der auf Amriswil fixierten Variante.
   - Kein `lockedLocation`, kein `detailOnly`: Vor der Ortswahl wird nur der schlanke Suchkopf gezeigt, nach der Wahl klappen Tagesleiste, Stundenverlauf und 7-Tage-Panel auf.
   - JS-freier Fallback (`LokalNoscript` mit Amriswil) wie bei den bestehenden Lokal-Embeds, plus `robots: noindex` und die üblichen Embed-Cache-Header.
   - Höhe wird über die bestehende `EmbedShell` per `postMessage` (`lovable-weather:height`) an den Host gemeldet.

2. **Snippet mit Auto-Höhe in `/embed-info`**
   - Neuer Eintrag „Lokalprognose mit Ortssuche“ in der Produktliste.
   - Eigene Snippet-Variante: iframe mit Startöhe ca. 260px plus kleines Skript, das auf `lovable-weather:height`-Nachrichten hört und die iframe-Höhe weich (CSS-Transition) anpasst — so „klappt“ die Prognose in WordPress sichtbar auf.
   - Sicherheitscheck im Skript: nur Nachrichten mit passendem `type` und plausibler Höhe (z. B. 120–4000px) werden übernommen.

3. **Aufklapp-Verhalten im Widget**
   - Sicherstellen, dass das Widget im Embed ohne gewählten Ort nur den Suchkopf rendert (kein leerer Platzhalterblock), damit die Startöhe klein bleibt.

## Technische Hinweise

- Neue Datei: `src/routes/embed.lokal-suche.tsx` (Muster: `src/routes/embed.lokal.tsx`).
- Anpassung: `src/routes/embed-info.tsx` — neue Snippet-Builder-Funktion `buildAutoHeightSnippet` plus Produkt-Eintrag.
- Ggf. kleine Darstellungsanpassung in `src/components/weather-widget.tsx` für den Zustand „kein Ort gewählt“ im Compact-Modus.
- Keine Änderungen an Datenquellen, Server-Funktionen oder der Datenbank.

## Prüfung

- `/embed/lokal-suche` direkt öffnen: nur Suchkopf sichtbar, nach Ortseingabe klappt die volle Prognose auf.
- Snippet in einer Test-HTML-Seite einbinden: iframe startet niedrig und wächst nach Ortswahl automatisch, ohne innere Scrollbalken.
- Mobile Breite prüfen (Suchfeld und Ortspille umbrechen korrekt).
