# Warnkarte-Embed: Widget nur Karte + Link, normales Embed bleibt interaktiv

Ziel: `/embed/widget-warnungen` zeigt nur die aktuelle Warnkarte und leitet beim Klick auf die WordPress-Warnseite weiter. `/embed/warnungen` behält dagegen das ursprüngliche Embed-Verhalten: Region-Klick öffnet das Info-Panel, Texte werden angezeigt, keine WordPress-Verlinkung.

## Was sich ändert

`src/components/maps/warn-map.tsx`:
- Trennung der bisherigen `embedMode = bare || snapshot` Logik:
  - `bare` = kompaktes Embed-Layout (kein Gefahren-Banner, kein Push-Block, schmalere Paddings), aber Karte bleibt interaktiv und das Info-Panel funktioniert wie in der App.
  - `snapshot` = Widget-Modus: nur Karte, keine Interaktion (kein Zoom/Drag/Region-Klick), Klick auf die Karte öffnet `WP_WARN_URL` im Top-Fenster (`target="_top"`).
- Das transparente Link-Overlay über der Karte wird nur im Widget (`snapshot`) gerendert.
- Karten-Interaktionen (`interactive`, `scrollWheelZoom`, `dragging`, `touchZoom`, `doubleClickZoom`, `keyboard`) hängen künftig von `!snapshot` ab.
- `onEachFeature` bindet Hover/Click-Handler nur, wenn `!snapshot` gilt.
- Das rechte Info-Panel wird bei `bare` wieder eingeblendet, bei `snapshot` weiterhin ausgeblendet.
- Im Info-Panel werden WordPress-Links (`wpLinkProps`) nur im Widget verwendet; im normalen Embed bleiben Ortsname und Warn-Einträge als reiner Text/ohne externe Verlinkung.
- `ZoomControl` bleibt im normalen Embed sichtbar, im Widget ausgeblendet.

`src/routes/embed.warnungen.tsx` und `src/routes/embed.widget-warnungen.tsx`:
- Keine Änderung der Props; die Unterscheidung erfolgt ausschliesslich in `warn-map.tsx` über `bare` vs. `snapshot`.

## Nicht im Scope

- Keine Änderung an der App-Seite `/karten/warnungen` oder `/warnkarte`.
- Keine Änderung an Warnlogik, Daten, Push oder Backend.
- Keine Änderung an den Snippets in `embed-info.tsx` (nur falls nötig, um Beschreibungen anzupassen).
