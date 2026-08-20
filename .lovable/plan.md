# Warnkarte mobil final abrunden

Die mobile Warnkarte ist aktuell 340 px hoch, das Info-Panel darunter maximal 300 px mit eigenem Scrollbereich. Beim Lesen längerer Warntexte muss man dadurch trotzdem noch innerhalb eines kleinen Fensters scrollen.

## Was geändert wird

- Karte auf dem Smartphone leicht kompakter halten (ca. 320 px), damit Karte plus Warntext ohne Seiten-Scrollen zusammen sichtbar bleiben.
- Info-/Warntext-Panel mobil auf ca. 340 px erhöhen und den internen Scrollbereich mit einem sanften Verlauf am unteren Rand kennzeichnen, damit sichtbar ist, dass noch Text folgt.
- Aktive Warnung mobil zuoberst im Panel, Legende darunter — kein Suchen mehr nach dem Warntext.
- Desktop/Tablet bleibt unverändert bei 600 px Karte und angeglichenem Panel.

## Technische Details

- `src/components/maps/warn-map.tsx`: mobile Höhe in Zeile ~475 von `h-[340px]` auf `h-[320px]`; Panel-Klasse `max-h-[300px]` auf `max-h-[340px] sm:max-h-none`; Scroll-Hinweis über eine `after:`-Gradientmaske am Panel-Container.
- Reihenfolge im Panel: Warnliste vor Legende, nur für den mobilen Breakpoint; ab `sm` bleibt die bestehende Anordnung.
- Keine Änderungen an Daten, Warnlogik, Push oder Embeds.
