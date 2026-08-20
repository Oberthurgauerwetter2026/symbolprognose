# Warn-Banner und Ortsmarker der Regionskarte auf die WP-Warnseite verlinken

Ziel: In der Wetterkarte Region führen sowohl das Warn-Panel oben („Warnungen aktiv“ / „Vorinformation“) als auch die Ortsmarker mit Warn-Badge auf `https://www.oberthurgauerwetter.ch/warnkarte/`.

## Warn-Panel oben

- Das Banner verlinkt künftig immer auf die WordPress-Warnseite — auch in der normalen App-Ansicht (bisher interner Link auf `/karten/warnungen`, im Embed auf `SITE_URL/warnkarte`).
- Im Embed-/Widget-Modus öffnet der Link im übergeordneten Fenster (`target="_top"`), sonst in einem neuen Tab.

## Ortsmarker mit Warnung

- Ortsmarker, die aktuell ein Warn-Badge (Blitz/Gefahrensymbol) tragen, werden klickbar und öffnen dieselbe WP-Warnseite.
- Marker ohne Warnung bleiben wie heute nicht interaktiv (Klick-Navigation zur Lokalprognose bleibt deaktiviert).
- Zeigerhand als Hinweis auf den Link; Optik der Pille bleibt unverändert.

## Technische Details

- `src/components/region-map.tsx`:
  - `WP_WARN_URL` aus `@/lib/warnings-config` importieren und für das Banner verwenden; einheitliche Link-Props (`target="_top"` bei `bare`/`fill`-Embed, sonst `target="_blank" rel="noopener"`).
  - `SpotMarker`: bei vorhandener `warning` `interactive` aktivieren, `eventHandlers.click` öffnet `WP_WARN_URL` (`window.top.location` im Embed, sonst `window.open`), plus `cursor: pointer` in der Pille.
- Keine Änderungen an Warnlogik, Daten oder Push.
