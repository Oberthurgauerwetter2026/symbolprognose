# Ab „Jetzt“ übernimmt das ICON-Modell

## Was sich ändert
- Das Verschieben des letzten Radarbilds (Nowcast) wird abgeschaltet.
- Direkt nach der letzten Messung zeigt die Karte die ICON-CH1-Prognose.
- Die erste Stunde nach „Jetzt“ läuft im Viertelstundentakt mit Modellbildern. Danach geht es wie bisher in vollen Stunden weiter, bis +48 Stunden.
- Der Filmstrip zeigt die Messung im 5-Minuten-Takt, dann bis +60 Minuten Viertelstunden und danach nur volle Stunden.
- Fehlt ein Modellbild, erscheint ein Ladefehler und nie eine trockene Karte.

## Hinweis
Das Modell verteilt manchmal eine Stundensumme gleichmässig auf vier Viertelstunden. Dann kann die erste Stunde kurz stillstehen. Das liegt an den Modelldaten und ist kein Fehler der Karte.

## Technische Details
- `src/lib/radar.functions.ts`: Nowcast-Frames nicht mehr erzeugen. `isModelSlot` lässt ab der letzten Messung bis +60 Min alle 15-Min-Slots durch, danach nur volle Stunden. Die Prognose beginnt beim ersten Slot nach der letzten Messung, damit keine Lücke entsteht.
- `src/components/maps/radar-map.tsx`: Den Nowcast-Zweig in den Timeline-Schritten entfernen. Viertelstunden immer bis `nowMs + HOUR`, danach HOUR.
- `src/lib/radar-nowcast.ts` und die Tests dazu bleiben im Code, werden aber nicht mehr aufgerufen. Ein Flag macht das Abschalten rückgängig.
- Den Timeline-Test für die Schritte „Messung → 15 Min → Stunde“ ergänzen und ausführen.
