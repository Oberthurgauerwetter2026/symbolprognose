# Wetterkarte Region: iframe schrumpft und schneidet ab

## Problem

Das Embed „Wetterkarte Region“ nutzt Auto-Höhe: das Widget meldet seine Höhe per postMessage, das WordPress-Skript setzt sie am iframe. Meldet das Widget kurzzeitig eine zu kleine Höhe (Neu-Mount der Karte nach Chunk-Load, Tab-Wechsel, Umschalten Karte ↔ Lokalprognose, Layout-Sprung während des Kartenaufbaus), wird das iframe sofort verkleinert — die Karte wirkt abgeschnitten und bleibt so, bis das nächste Grössen-Ereignis kommt.

## Lösung

Höhenmeldung und Höhenanwendung robust gegen kurzzeitige Einbrüche machen:

1. **Widget-Seite (Höhe melden)**
   - Höhe aus dem gesamten Dokumentinhalt statt nur aus dem Container ermitteln (verhindert Messungen von 0/klein während des Aufbaus).
   - Messungen unter einer Mindesthöhe verwerfen, statt sie zu senden.
   - Meldungen leicht entprellen und nach dem Laden von Karte/Bildern eine Nachmeldung senden.

2. **Host-Snippet (Höhe anwenden)**
   - Vergrösserungen sofort anwenden.
   - Verkleinerungen nur übernehmen, wenn die kleinere Höhe ca. 500 ms stabil bleibt und der Unterschied relevant ist — so führt ein kurzer Einbruch nicht mehr zum Abschneiden.
   - Untergrenze im Snippet (Startwert der Karte), damit das iframe nie unter Kartenhöhe fällt.

3. **Regions-Embed selbst**
   - Der Kartenbereich erhält eine Mindesthöhe (auch im Suspense-Zustand), damit beim Wechsel Karte ↔ Lokalprognose kein Nullhöhen-Moment entsteht.

## Technisch

- `src/components/embed-shell.tsx`: `send()` nutzt `Math.max(container.getBoundingClientRect().height, document.documentElement.scrollHeight)`, verwirft Werte < 200 px, entprellt per `requestAnimationFrame`/Timeout und meldet zusätzlich nach `window.load` sowie kurz verzögert (~600 ms) nach.
- `src/routes/embed-info.tsx`: `buildAutoHeightSnippet` erhält Anti-Shrink-Logik (Merken der letzten Höhe, `setTimeout`-Bestätigung für Verkleinerungen > 40 px, `minHeight`-Parameter).
- `src/routes/embed.region.tsx`: Suspense-Fallback und Kartenwrapper mit `min-h-[480px]`.

Keine Änderungen an Wetterdaten, Warnlogik oder Backend. Nach dem Umbau muss das Snippet in WordPress neu kopiert werden, da die Skriptlogik im Snippet steckt.
