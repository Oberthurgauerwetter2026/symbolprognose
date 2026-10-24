# Lücke zwischen „Jetzt“ und der ersten vollen Stunde füllen

## Was sich ändert
- Nach „Jetzt“ bleibt die Karte bis zur nächsten vollen Stunde nicht mehr leer.
- In dieser Zeit wird das Modellbild der laufenden Stunde gezeigt, also das letzte vorhandene Stundenbild.
- Ab der ersten vollen Stunde läuft die Prognose wie bisher weiter.
- Fehlt auch dieses Bild, erscheint wie bisher ein Ladefehler und nie eine trockene Karte.

## Technische Details
- `src/lib/radar.functions.ts`: Bisher werden alle Prognose-Frames mit `t <= now` verworfen. Neu wird der jüngste Prognose-Frame mit `t <= now` (Stunde, in der „Jetzt“ liegt) behalten und als Brückenframe auf den ersten 15-Min-Slot nach der letzten Messung gesetzt. Bild-URL und Werte bleiben die des Originals (`sourceT` = Original-Zeit). Nur wenn vor der ersten vollen Stunde kein echter Frame existiert.
- `src/components/maps/radar-map.tsx` (Timeline, ca. Z. 2131–2152): Gibt es zwischen „Jetzt“ und der ersten vollen Stunde keinen Treffer, den Brückenframe in die Filmstrip-Zeiten aufnehmen, damit Filmstrip und Karte ihn zeigen.
- Kleinen Test für die Timeline-Regel ergänzen: Ohne Viertelstunden-Bilder enthält die Zeitachse nach „Jetzt“ genau einen Brückenframe vor der ersten vollen Stunde.
