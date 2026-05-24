# Iframe-Snippet selbst auch flexibler machen

Das Embed-Markup setzt aktuell ein hartes `min-height: 1100px` auf dem `<iframe>` für `/embed/region-lokal`. Das ist ein **Mindestplatz**, den der WordPress-Host immer reserviert — auch in einer 300 px schmalen Spalte, in der die Karte + Detailprognose zusammen nur ~700–800 px hoch sind. Nach dem ersten `postMessage` korrigiert sich die Höhe zwar nach unten, aber der initiale „Reservierungssprung" sorgt für unnötige Leere und Layout-Shift.

## Änderungen in `src/routes/embed-info.tsx`

1. `buildSnippet` so anpassen, dass das `min-height` als **Startwert** kleiner ist (`320px` Default) — die echte Höhe wird ohnehin sofort per `postMessage` gesetzt. Der `min-height` dient nur noch als Fallback, falls JS deaktiviert ist.
2. Aufruf für `region-lokal`: `buildSnippet(url, "/embed/region-lokal", "region-lokal")` ohne den Höhen-Override (statt `1100`).
3. Aufruf für `/embed/all` bleibt bei einem moderaten Fallback (`760`, Default), denn der hat Tabs.

Damit der iframe in einer schmalen Spalte sofort sauber sitzt:
- Snippet erhält zusätzlich `max-width:100%` (für Hosts, die das `<iframe>` in ein flex/grid mit fester Spaltenbreite packen).
- Höhe wird per `postMessage` weiterhin live nachgeführt — bei Resize des Hosts springt die Iframe-Höhe direkt mit (`ResizeObserver` in `EmbedShell` ist bereits aktiv).

### Konkretes neues Snippet (für alle Embeds)

```
<iframe
  id="wx-region-lokal"
  src=".../embed/region-lokal"
  style="width:100%;max-width:100%;min-height:320px;border:0;display:block"
  loading="lazy"
  title="Wetter-Karte"
></iframe>
<script>…postMessage-Listener wie bisher…</script>
```

## Nicht angefasst

- `/embed/*`-Routen selbst — die sind bereits durch den letzten Schritt voll responsiv.
- `postMessage`-Mechanik in `EmbedShell` — bleibt unverändert.
- Andere Snippets (Einzelkarten) übernehmen ebenfalls den kleineren Default; das verbessert ihre Einbettung in schmalen Spalten ebenfalls.
