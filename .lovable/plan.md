## Ziel

Sechs Punkte an der Wetterwarnkarte und der Benachrichtigungs-Box beheben bzw. verbessern.

## 1. Hover färbt Gemeinden grün (Bug)

In `src/components/maps/warn-map.tsx` werden die Hover-Handler in `onEachFeature` nur beim ersten Rendern gesetzt. `mouseout` ruft dort eine eingefrorene `styleFor`-Version auf – aus der Zeit, als noch keine Warnungen geladen waren. Deshalb springt eine gewarnte Gemeinde nach dem Überfahren auf Grün (Stufe 0).

Fix: die aktuellen Warnstufen über eine Ref halten, auf die die Handler zugreifen, sodass `mouseout` immer den echten aktuellen Stil zurücksetzt. Hover verändert dann nur noch Rahmenstärke/-farbe, nie die Füllfarbe.

## 2. Legende nur auf Klick

Legende wird zum ein-/ausklappbaren Overlay: kleiner Button „Legende“ unten links auf der Karte; nach Klick öffnet sich das Farbschema-Panel mit einem X zum Schliessen. Standard: geschlossen.

## 3. Karte mobiltauglich

- Gefahren-Banner: horizontal scrollbare Chip-Leiste statt Umbruch-Chaos; Statusanzeige („Höchste Stufe …“) rückt auf Mobile in eine eigene Zeile.
- Karte/Panel: einspaltig auf Mobile, Kartenhöhe reduziert (ca. 380 px), Info-Panel darunter.
- Touch: Legenden-Toggle und Gemeinde-Auswahl mit ausreichend grossen Trefferflächen; Hover-Effekte nur bei echten Zeigergeräten.
- Zoom-Control und Labels bleiben lesbar (Label-Schrift leicht grösser).

## 4. Benachrichtigungen: Standard 0 Gemeinden

In `src/components/warnings/push-opt-in.tsx`:
- Startzustand ist eine leere Auswahl statt „alle Gemeinden“; auch die automatische Vorauswahl über eine angeklickte Gemeinde entfällt (bzw. wird nur als Vorschlag gesetzt, wenn noch nichts gewählt ist – Standard bleibt leer).
- Der Aktivieren-Button bleibt deaktiviert, bis mindestens eine Gemeinde angekreuzt ist (bestehendes Verhalten).

## 5. Lesbarkeit der Benachrichtigungs-Box

- Schriftgrössen von 10/11 px auf normale Grössen anheben (Text ~14 px, Chips ~13 px).
- Kontrast erhöhen: Fliesstext in Vordergrundfarbe statt durchgehend gedämpft.
- Mehr vertikaler Abstand zwischen Erklärtext, Auswahlzähler, Gemeindeliste, Button und Hinweisen.
- Gemeinde-Chips grösser und mit deutlicherem Aktiv-Zustand (Häkchen + Farbfüllung bleiben).

## 6. Warntexte wetterdiensttauglicher

Die Vorlagen in `src/lib/warnings-config.ts` (`TEMPLATES`) werden überarbeitet nach dem Muster offizieller Dienste (MeteoSchweiz/DWD):

- Einheitlicher Aufbau je Warnung: **Was** (Wetterereignis mit Kennwert), **Wann** (Gültigkeit, kommt bereits aus dem Zeitraum), **Auswirkungen**, **Verhaltenshinweis**.
- Sachlicher, unpersönlicher Präsens-Stil, konkrete Schwellenwerte statt vager Formulierungen.
- Neues Feld „Empfohlenes Verhalten“ pro Gefahr/Stufe, das im Info-Panel der Karte und in der Detailansicht unter „Mögliche Auswirkungen“ angezeigt wird.
- Vorlagen bleiben editierbar: das Admin-Tool füllt sie weiterhin vor, die Redaktion kann sie überschreiben.

## Technische Hinweise

- Betroffene Dateien: `src/components/maps/warn-map.tsx`, `src/components/warnings/push-opt-in.tsx`, `src/lib/warnings-config.ts`, sowie die Anzeige des neuen Verhaltensfelds in `src/components/weather-widget.tsx`/Embeds, falls dort Warntexte gerendert werden.
- Das neue Verhaltensfeld ist rein aus den Vorlagen abgeleitet; keine Datenbankänderung nötig, sofern es zusammen mit `impact` gespeichert wird. Alternativ eine kleine Migration für eine Spalte `advice` – ich würde ohne Migration starten und den Hinweis an den Auswirkungstext anhängen.
