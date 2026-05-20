## Drei kleine UI-/Embed-Erweiterungen

### 1. Legende beim 3-Stunden-Marker

Der bestehende Inline-Label am Kadenzbruch ("ab +12 h · 3-h-Takt") ist leicht zu übersehen. Zusätzlich:

- Oberhalb der scrollbaren Stundenleiste (im Detail-Panel-Header neben "Stundenverlauf · …") eine kleine Legende einblenden:
  `[ ▍ ] 1-Stunden-Takt   [ ┃ ] 3-Stunden-Takt (ab +12 h)`
  — zwei kurze farbige Balken (zinc-300 dünn / zinc-400 dick, passend zu den Slot-Bordern), Text in `text-[11px] uppercase tracking-wider text-zinc-500`.
- Der absolute Inline-Hinweis am Bruch bleibt erhalten (visuelle Verankerung), bekommt aber weniger Gewicht.

Nur Markup im Detail-Panel, keine Datenlogik.

### 2. Ortsanzeige unter dem Suchfeld (außer Default Amriswil)

In `Header` direkt unter der Suchzeile:

- Wenn `location.name !== "Amriswil"` (oder genauer: != Default-Koordinaten) eine Zeile zeigen:
  `Aktuell: <Ortsname>` in `text-sm font-semibold text-zinc-800`, mit kleinem `Pin`-Glyph davor.
- Bei Default (Amriswil) wird nichts angezeigt — Layout bleibt kompakt.
- Voraussetzung: `WeatherWidget` reicht ein Flag `isDefaultLocation` an `Header` weiter (Vergleich gegen `DEFAULT_LOCATION`), damit auch ein User, der explizit "Amriswil" über die Suche wählt, weiterhin keinen Hinweis sieht (oder wir nehmen einfach den Namen-Vergleich — bitte sag, was du bevorzugst; ich nehme im Zweifel den Namen-Vergleich, ist robuster gegenüber Koordinaten-Rauschen).

Placeholder im Input wird dann auf das schlichte `Gemeinde suchen…` gekürzt (der aktuelle Ort steht ja jetzt darunter).

### 3. Separater Embed-Code ohne Suchfeld

URL-Parameter `?embed=minimal` (parse via `window.location.search` einmalig beim Mount, kein Router-Roundtrip nötig — das Widget ist eine reine Client-Komponente in der iframe).

- `WeatherWidget` liest das Flag und gibt es an `Header` weiter (`hideSearch`).
- `Header` rendert in dem Fall nur den Ortsnamen + "Ortung"-Button (kein Input, keine Suchergebnisse-Dropdown).
- Toggles (Sonnenschein/Schnee) bleiben.

In `src/routes/embed-info.tsx` einen **zweiten** Snippet-Block hinzufügen:
- Überschrift "Minimal-Variante (ohne Gemeindesuche)"
- gleiches `<iframe>` wie bisher, aber `src="${url}/?embed=minimal"`
- eigener Copy-Button

Beide Snippets bleiben verfügbar; bestehende Einbettungen ohne Param funktionieren unverändert.

## Was unverändert bleibt

- Datenfluss (`fetchForecast`, Persist-Cache, Modell-Priorität)
- Toggles, 1h/3h-Logik, Daily-Aggregation
- postMessage-Höhenkommunikation

## Eine offene Frage

Bei Punkt 2: Vergleich über **Ortsname** ("Amriswil" via Suche zeigt nichts) oder über **Default-Marker** (jede explizit gewählte Stadt – auch Amriswil – zeigt den Hinweis)? Default-Annahme: Namen-Vergleich (einfacher, bei Amriswil immer ruhig).
