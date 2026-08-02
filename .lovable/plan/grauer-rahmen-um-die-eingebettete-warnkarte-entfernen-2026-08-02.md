# Grauer Rahmen um die eingebettete Warnkarte entfernen

## Beobachtung

Die Seitengrundfarbe der App ist ein hellgraues Zinc-100 (`--background` in `src/styles.css`, angewendet auf `html, body`). Im Embed-iframe füllt diese Farbe die gesamte Fläche, während die Karte, die Gefahren-Leiste und das Infopanel weisse Karten (`bg-card`) sind. Auf der WordPress-Seite (weisser Inhaltsbereich) wirkt das wie ein grauer Rahmen rund um die Karte — zusätzlich verstärkt durch das Innen-Padding der Embed-Hülle.

## Änderung

- Im Embed-Kontext den Seitenhintergrund transparent machen, damit die WordPress-Seitenfarbe durchscheint und kein grauer Rand entsteht.
- Innen-Padding der Embed-Hülle für die Warnkarte auf 0 reduzieren, damit die Karte randlos im iframe sitzt.
- Alle übrigen Embeds und die normale App-Ansicht bleiben unverändert.

## Technisch

- `src/styles.css`: neue Regel, die bei gesetzter Embed-Markierung (`html.embed`) `html, body { background: transparent; }` setzt; `.embed-fallback` / `.embed-live` behalten ihr Weiss nur als Fallback-Fläche oder werden ebenfalls auf `transparent` gestellt.
- `src/components/embed-shell.tsx`: beim Mount `document.documentElement.classList.add("embed")` (und im Cleanup entfernen), damit die Regel nur in `/embed/*`-Routen greift.
- `src/routes/embed.warnungen.tsx`: `<div className="p-2">` um `WarnMap` entfernen bzw. auf `p-0` setzen.
- Keine Änderungen an Warnlogik, Daten, Backend oder Push.
