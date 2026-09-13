# Lokalprognose automatisch und kompakt öffnen

## Ziel

Die Lokalprognose öffnet auf der Website und im WordPress-Embed automatisch für den Standort des Besuchers. Zunächst erscheint eine platzsparende Übersicht; die vollständige Prognose wird bewusst geöffnet. Das überflüssige Kartenlabel entfällt.

## Umsetzung

1. **Kartenlabel entfernen**
   - Den Button „Karte“ im Kopf der Lokalprognose vollständig entfernen.
   - Suche, Ortung, Ortsname, Favorit sowie Sonne-/Schnee-Schalter bleiben erhalten.

2. **Standort automatisch verwenden**
   - Beim Öffnen der normalen Lokalprognose und des Lokalprognose-Embeds automatisch die Browser-Standortfreigabe nutzen.
   - Ein ausdrücklich übergebener Ort aus einem Link hat weiterhin Vorrang.
   - Ist die Standortfreigabe nicht verfügbar oder wird sie abgelehnt, bleibt die Ortssuche mit Ortungsbutton sichtbar.

3. **Kompakte automatische Startansicht**
   - Nach erfolgreicher automatischer Ortung zunächst eine kompakte Vorschau anzeigen:
     - die Tageskacheln mit Wettersymbolen und Temperaturen,
     - eine verkürzte Stundenprognose für die nächsten Stunden,
     - den Button „Ganze Prognose anzeigen“.
   - Ausführliche Tageszusammenfassung, komplette Stundenreihe, Zusatzwerte, Quellen und weitere Detailbereiche bleiben in dieser Ansicht zunächst verborgen.

4. **Vollständige Prognose öffnen**
   - Ein Klick auf „Ganze Prognose anzeigen“ blendet die bestehende vollständige Prognose ein.
   - Wählt der Besucher über die Ortssuche oder den Ortungsbutton bewusst einen Ort, wird direkt die vollständige Prognose gezeigt.
   - Die Tagesauswahl und vorhandene horizontale Scrollfunktion bleiben in beiden Ansichten nutzbar.

5. **Website und WordPress-Embed angleichen**
   - Das neue Verhalten gilt für `/karten/lokal` und `/embed/lokalprognose`.
   - Andere feste oder reine Detail-Embeds bleiben unverändert.
   - Die automatische Höhenanpassung des WordPress-Embeds reagiert auch auf das Aufklappen zur vollständigen Prognose.

## Technische Hinweise

- Der bestehende Wetterdatenabruf und die Prognoseberechnung bleiben unverändert.
- Der Ansichtsstatus unterscheidet zwischen automatisch ermitteltem und bewusst gewähltem Ort.
- Für die kompakte Stundenansicht werden die vorhandenen Stundenwerte und Wetterdarstellungen wiederverwendet, nicht separat geladen.
- Neue Steuerelemente verwenden die vorhandenen Design-Komponenten und semantischen Farben.

## Prüfung

- Website und Embed mit erlaubter, abgelehnter und nicht verfügbarer Standortfreigabe testen.
- Prüfen: automatische Ortung führt zur kompakten Ansicht; Ortssuche, Ortungsbutton und „Ganze Prognose anzeigen“ führen zur vollständigen Ansicht.
- Direkte Links mit Ort sowie Favoriten-/Ortswechsel testen.
- Mobile und Desktop-Darstellung sowie automatische Embed-Höhe prüfen.
