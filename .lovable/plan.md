## Ziel

Der iframe-Snippet, den Nutzer in WordPress einbetten, soll sich **vollständig** an seinen Container anpassen — sowohl in der Breite (schmale Spalten, Sidebars) als auch in der Höhe (kein reservierter Leerraum, sofortiges Mitwachsen/-schrumpfen).

## Aktueller Stand

- Breite: `width:100%; max-width:100%` ist bereits gesetzt ✅
- Höhe: `min-height:320px` als Fallback + `postMessage` setzt `height` live.
- Innen: `EmbedShell` hat einen `ResizeObserver` und sendet bei jeder Größenänderung die neue Höhe.

## Schwachstellen

1. **`min-height:320px`** verhindert, dass der iframe in sehr kompakten Hosts (z.B. Sticky-Sidebar 260px) unter 320px schrumpft, selbst wenn der Inhalt es zuließe.
2. Das Snippet setzt **nur `style.height`**, aber nicht `style.minHeight = '0'`. Dadurch bleibt der initiale `min-height`-Wert dominant, auch wenn die postMessage-Höhe kleiner ist.
3. Beim allerersten Render (vor erstem `postMessage`) reserviert der iframe sichtbar Platz — bei schmalem Host springt das Layout.
4. Keine `box-sizing`-Absicherung — manche WordPress-Themes setzen `border` oder `padding` global auf iframes und brechen dann die 100%-Breite.

## Änderungen in `src/routes/embed-info.tsx` → `buildSnippet`

Neues Snippet-Template:

```html
<iframe
  id="wx-{id}"
  src="{url}{path}"
  style="width:100%;max-width:100%;min-width:0;height:0;border:0;display:block;box-sizing:border-box"
  loading="lazy"
  title="Wetter-Karte"
></iframe>
<script>
  (function () {
    var f = document.getElementById("wx-{id}");
    if (!f) return;
    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "lovable-weather:height" && e.source === f.contentWindow) {
        f.style.height = e.data.height + "px";
      }
    });
  })();
</script>
```

Wichtige Punkte:
- `height:0` statt `min-height:320px` → der iframe nimmt vor der ersten Höhen-Message **null Platz** ein und wächst dann genau auf die gemeldete Höhe. Kein Reservierungssprung mehr.
- `min-width:0` → erlaubt Schrumpfen in Flex-/Grid-Containern ohne 280-px-Mindestbreite.
- `box-sizing:border-box` → schützt vor Theme-CSS, das padding/border auf iframes setzt.
- `e.source === f.contentWindow` → ignoriert fremde postMessages anderer Embeds auf derselben Seite (wichtig, wenn Nutzer mehrere Karten einbinden).
- `(function(){})()` als IIFE → keine Globalen, Snippet kann mehrfach pro Seite vorkommen.

## Fallback ohne JavaScript

Da `height:0` ohne JS bedeutet „unsichtbar", ergänze unmittelbar nach dem `<iframe>`-Tag ein `<noscript>`:

```html
<noscript>
  <style>#wx-{id}{height:600px}</style>
</noscript>
```

Setzt nur dann eine sinnvolle Mindesthöhe, wenn JS deaktiviert ist (selten, aber sauber).

## Nicht angefasst

- `EmbedShell` (ResizeObserver + postMessage funktionieren bereits korrekt) — sendet bei jeder Breiten- und Inhaltsänderung automatisch die neue Höhe, so dass der iframe live mitschrumpft, wenn die Spalte schmaler wird.
- `/embed/*`-Routen sind durch die letzten Schritte bereits voll responsiv.
- `MAPS`-Einzelkarten profitieren automatisch vom neuen Default.

## Effekt

- Schmale 260-px-Sidebar: iframe nimmt exakt die gerenderte Höhe ein (oft 600–700 px statt vorher hartem 320 px Mindestplatz vor erstem Message).
- Volle Breite 1200 px: unverändert.
- Live-Resize des Hosts (z.B. Browser-Zoom, Spalten-Drag): iframe folgt sofort, weil `ResizeObserver` in der Embed-Seite jede Breitenänderung registriert.
