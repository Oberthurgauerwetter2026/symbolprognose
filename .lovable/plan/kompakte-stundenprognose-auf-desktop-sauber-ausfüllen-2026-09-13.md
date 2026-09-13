# Kompakte Stundenprognose auf Desktop sauber ausfüllen

## Ziel
Die kompakte Stundenprognose soll auf breiten Bildschirmen nicht mehr rechts abgeschnitten oder unfertig wirken. Alle acht angezeigten Stunden füllen die verfügbare Breite gleichmässig aus.

## Umsetzung
- Die acht Stundenfelder behalten auf kleinen Bildschirmen ihre kompakte Mindestbreite und bleiben horizontal scrollbar.
- Ab Desktopbreite wachsen die Stundenfelder gleichmässig, bis sie den gesamten Bereich ausfüllen.
- Trennlinien, Wetterwerte, Symbole und der dezente Scrollschatten bleiben unverändert.
- Es werden keine zusätzlichen Stunden ergänzt und keine Prognoselogik verändert.

## Prüfung
- Desktop: keine leere Fläche rechts; alle acht Felder sind gleich breit und reichen bis zum rechten Rand.
- Mobil: horizontales Wischen und die bisherige kompakte Feldbreite funktionieren weiterhin.
- Typprüfung und Vorschau-Build ohne Fehler abschliessen.

## Technische Details
Die feste Breite der Felder in `CompactHourlyStrip` wird responsiv um eine gleichmässige Flex-Verteilung ergänzt. Die bestehende Mindestbreite verhindert, dass Inhalte auf schmalen Geräten zusammengedrückt werden.
