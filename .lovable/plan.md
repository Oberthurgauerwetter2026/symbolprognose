## Ziel

1. Tages-Übersicht zeigt auf dem Desktop alle 7 Tage gleichzeitig (statt 5 mit horizontalem Scroll).
2. Iframe-Einbettung passt Höhe dynamisch an Inhalt + Viewport an — sowohl auf Desktop als auch auf Smartphones in WordPress.

---

## 1. DayStrip — alle 7 Tage anzeigen

Datei: `src/components/weather-widget.tsx` (DayStrip, ca. Zeile 320–395)

Aktuelle `basis`-Klassen zeigen 5 Tage ab 900px. Anpassen auf:

- `basis-[70%]` (sehr schmal)
- `@[420px]:basis-[45%]`
- `@[640px]:basis-[calc(100%/4-1px)]` (4 Tage)
- `@[820px]:basis-[calc(100%/5-1px)]` (5 Tage)
- `@[1000px]:basis-[calc(100%/7-1px)]` (alle 7 Tage gleichzeitig)

Der Container bleibt scrollbar, damit kleinere Breiten weiterhin funktionieren. `days.slice(0, 7)` bleibt — alle vorhandenen Tage werden gerendert.

Schriftgrössen in den Tageskacheln leicht skalierbar machen, damit 7 Spalten ab 1000px sauber passen:
- Temperatur `text-2xl` → `text-xl @[1100px]:text-2xl`
- Innen-Padding `p-3 @[640px]:p-4` → `p-3 @[640px]:p-4 @[1000px]:p-3` (kompakter wenn 7 nebeneinander)

---

## 2. Responsives Embed-Snippet

### a) Widget sendet seine Höhe an Parent

In `WeatherWidget` (oder einem kleinen Effect daneben) `ResizeObserver` auf das Root-Div setzen und bei Änderung
```ts
window.parent.postMessage(
  { type: "lovable-weather:height", height: el.scrollHeight },
  "*"
);
```
posten. Funktioniert nur, wenn die Seite eingebettet ist — schadet aber nicht im Stand-alone-Modus.

### b) Neues Snippet in `src/routes/embed-info.tsx`

Iframe ohne festes `min-height`, dafür `width:100%`, plus kleines Inline-Script, das die Höhe via `postMessage` empfängt:

```html
<iframe
  id="wx-widget"
  src="https://…/"
  style="width:100%;border:0;display:block"
  loading="lazy"
  title="Wetterprognose"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "lovable-weather:height") {
      var f = document.getElementById("wx-widget");
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>
```

Ergebnis:
- Desktop in WordPress: Breite folgt dem Beitrags-Container, Höhe folgt dem tatsächlichen Inhalt (z. B. weniger hoch, wenn nur 7 Tage in einer Zeile passen).
- Smartphone: Widget bricht intern via `@container`-Queries auf ≤640px-Layout um; Iframe-Höhe wächst entsprechend mit, kein Scrollbar im Iframe.

Fallback: Falls JS im WP-Beitrag blockiert ist, `min-height:760px` als CSS-Default im Iframe-Style behalten.

### c) Hinweis im Embed-Info-Text

Kurzen Satz ergänzen, dass das Snippet inklusive `<script>`-Block kopiert werden muss (Custom-HTML-Block in WordPress erlaubt das).

---

## Technische Details

- `ResizeObserver` ist im Cleanup-Effect zu disconnecten.
- `postMessage`-Target `"*"` ist akzeptabel, da nur eine Höhe (kein sensibles Payload) gesendet wird.
- Keine Änderungen an `weather.ts` oder am Datenmodell nötig — alle 7 Tage werden bereits geladen.