# Mobile Regionskarte kompakter ausrichten

## Ziel
Auf dem Handy soll die Wetterkarte den Oberthurgau ohne grossen leeren Bereich darunter zeigen. Alle fünf Hauptorte bleiben sichtbar, ihre Prognosefelder überdecken sich aber deutlich weniger.

## Änderungen

1. **Mobile Kartenhöhe reduzieren**
   - Die derzeit feste Höhe von 560 px wird auf eine passendere mobile Höhe von ungefähr 430–450 px verkürzt.
   - Ab Tablet bleibt die bestehende Höhe von 600 px unverändert.
   - Ladeplatzhalter und Karte erhalten dieselbe Höhe, damit beim Laden nichts springt.

2. **Kartenausschnitt mobil besser einpassen**
   - Für schmale Ansichten wird die Region leicht nach unten bzw. zentraler im verfügbaren Kartenfenster ausgerichtet.
   - Der Ausschnitt berücksichtigt weiterhin Suchfeld, Zoomtasten und vollständige Ortsfelder.
   - Desktop-Ausschnitt und Zoomverhalten bleiben unverändert.

3. **Ortsfelder mobil kompakter gestalten**
   - Prognosefelder, Wettersymbole, Innenabstände und Schrift werden nur auf kleinen Bildschirmen moderat verkleinert.
   - Namen und Min-/Max-Temperaturen bleiben vollständig lesbar.
   - Die fünf Hauptorte werden mit mobilen Anzeigeversätzen gezielt verteilt, insbesondere Münsterlingen, Romanshorn und Amriswil.
   - Beim Hineinzoomen bleiben die zusätzlichen Orte wie bisher verfügbar.

4. **Überlagerungen kontrollieren**
   - Suchfeld, Zoomtasten, Quellenzeile, Warnsymbole und Tagesauswahl dürfen keine Ortsfelder verdecken.
   - Die Wetterdaten, Ortsauswahl und Karteninteraktionen werden nicht verändert.

## Prüfung

- Mobile Vorschau bei 390–402 px Breite prüfen.
- Sicherstellen, dass alle fünf Hauptorte erkennbar sind und der bisher leere untere Kartenteil weitgehend entfällt.
- Karte zusätzlich auf Tablet und Desktop kontrollieren, damit dort Darstellung und Höhe unverändert bleiben.

## Technisch

Die Anpassung bleibt in der Regionskarten-Darstellung. Mobile Markergrössen und Anzeigeversätze werden aus der tatsächlichen Kartenbreite abgeleitet; Prognosekoordinaten und Datenabfragen bleiben unangetastet.
