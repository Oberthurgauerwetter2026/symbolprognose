# Infopanel: Start mit Legende statt Warnliste

## Verhalten neu

Beim Öffnen der Warnkarte (ohne ausgewählte Region) zeigt das Infopanel rechts keine Warnungen mehr, sondern die Legende:

- Titel bleibt "Region Oberthurgau".
- Darunter die Farb-Legende der Stufen 0-3 (keine Gefahr / gering / erheblich / gross) plus Hinweis "schraffiert = Vorinformation".
- Kurzer Hinweistext: "Gemeinde auf der Karte antippen, um Warnungen anzuzeigen."
- Der Abo-Block ("Warnungen abonnieren") bleibt unverändert darunter.

Erst nach Klick/Tipp auf eine Gemeinde erscheinen wie bisher die Warnungen dieser Gemeinde (bzw. der Text "Zurzeit keine Warnungen für diese Gemeinde"). Das "x" im Panel-Kopf setzt die Auswahl zurück und zeigt wieder die Legende.

Die kleine Legende-Overlay-Schaltfläche in der Karte bleibt bestehen.

## Technische Details

- `src/components/maps/warn-map.tsx`: Im Panel-Inhalt (Bereich um Zeile 637) auf `selected` verzweigen: ohne Auswahl eine Legende-Ansicht rendern (gleiche Farbfelder wie das Karten-Overlay aus `LEVELS`, plus Schraffur-Eintrag), mit Auswahl die bestehende `selectedWarnings`-Liste.
- `selectedWarnings` muss ohne Auswahl nicht mehr die Gesamtliste liefern; Rückgabe eines leeren Arrays ohne `selected` genügt, die Kartenflächen nutzen `levelByRegion`/`advisoryByRegion` und bleiben unverändert.
- Keine Änderungen an Datenbank, Server-Funktionen oder Push.
