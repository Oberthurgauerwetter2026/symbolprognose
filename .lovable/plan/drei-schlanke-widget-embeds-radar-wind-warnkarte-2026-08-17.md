# Drei schlanke Widget-Embeds: Radar, Wind, Warnkarte

Ziel: je ein Snippet für WordPress-Widgets (Sidebar/Spalte), das nur den aktuellen Zustand zeigt — ohne Filmstrip, ohne Play/Pause, ohne Zeitnavigation.

## Was entsteht

Drei neue Embed-Seiten (die bestehenden `/embed/radar`, `/embed/wind`, `/embed/warnungen` bleiben unverändert):

1. `/embed/widget-radar` — nur die aktuellste Radarmessung (kein Prognoseteil, keine Animation). Zeitstempel der Messung als kleine Pille im Bild.
2. `/embed/widget-wind` — Windprognose für die laufende bzw. nächste Stunde (der Frame, der „jetzt“ am nächsten liegt). Farb-Layer plus Partikel wie gewohnt, ohne Zeitleiste.
3. `/embed/widget-warnungen` — Warnkarte mit den aktuell aktiven Warnungen: Karte plus kompakte Warnliste, ohne Filter-Leiste und ohne Push-Bereich (Push braucht einen eigenen Tab, dafür bleibt `/warnkarte` bzw. `/embed/warnungen`).

Gemeinsam:
- Ortsmarken und Gemeindegrenzen wie bisher, Legende weiterhin als kleiner „i“-Button.
- Quellenangabe bleibt sichtbar (rechtlich nötig).
- Karten bleiben zoom-/verschiebbar; nur die Zeitsteuerung fällt weg.
- Live-Aktualisierung: Radar und Wind ziehen im bestehenden Intervall nach, Warnungen per Realtime — das Widget bleibt also ohne Reload aktuell.

## Snippets

In `/embed-info` kommen drei neue Einträge dazu („… für WP-Widget“) mit empfohlener Höhe je ca. 420 px und `loading="lazy"`, damit die Widgets die Seite nicht ausbremsen. Snippets zeigen wie bisher auf die publizierte Domain.

## Technische Umsetzung

- Neue Prop `snapshot?: boolean` in `radar-map.tsx`, `wind-map.tsx` und `warn-map.tsx`:
  - Radar: Steuerpanel (Play/Prev/Jetzt/Filmstrip) wird nicht gerendert; Zeitachse wird beim Laden fest auf den letzten Messframe gesetzt (`stripNowIdx`), Autoplay deaktiviert; Prognoseframes werden ignoriert.
  - Wind: Steuerpanel entfällt; `idx` wird auf den Frame mit minimalem `|t − now|` gesetzt und bei Daten-Refresh neu bestimmt; `playing` bleibt `false`.
  - Warnkarte: Hazard-Filterleiste und Push-Opt-in ausgeblendet, Info-Panel bleibt scrollbar.
- Drei Routen `src/routes/embed.widget-radar.tsx`, `embed.widget-wind.tsx`, `embed.widget-warnungen.tsx` nach Muster von `embed.satellit-loop.tsx`: `EmbedShell fillViewport`, `ClientOnly` + `lazy`, `setEmbedCacheHeaders()`, `robots: noindex`.
- `src/routes/embed-info.tsx`: drei Produkteinträge mit `buildSimpleSnippet`, Höhe 420, lazy.
- Keine Änderungen an Ingest, Datenmodell oder bestehenden Karten-/Embed-Routen.
