Horizontale Scroll-Schatten für Prognosen

## Ziel
Beim horizontalen Wischen soll an der Kante, unter der bereits gescrollter Inhalt verschwindet, ein schwacher Schatten erscheinen – wie im gezeigten Referenzbeispiel. Die gegenüberliegende Kante weist dezent auf weiteren Inhalt hin.

## Betroffene Bereiche
- Tageskarten der Lokalprognose.
- Stündliche Detailprognose mit Wetterwerten und Diagrammen.
- Horizontal scrollbare Tagesauswahl der Wetterkarte Region.

## Verhalten
- Am Anfang erscheint nur rechts ein sehr dezenter Hinweis auf weitere Inhalte.
- Nach dem ersten Verschieben erscheint links der gewünschte Schatten über dem verschwindenden Inhalt.
- Vor dem Ende bleiben beide Kanten sichtbar; ganz am Ende verschwindet der rechte Schatten.
- Ohne horizontalen Überlauf erscheinen keine Schatten.
- Wischen, Scroll-Snap, automatische Positionierung und bestehende Inhalte bleiben unverändert.

## Technische Umsetzung
- Eine kleine wiederverwendbare Scroll-Rand-Komponente beziehungsweise ein Hook ermittelt `scrollLeft`, sichtbare Breite und Gesamtbreite.
- Die Schatten werden als nicht anklickbare, überlagerte Farbverläufe an den Kanten gerendert. Dadurch bleiben sie auch über den verschiedenfarbigen Prognosekacheln zuverlässig sichtbar.
- Größenänderungen und nachgeladene Prognosedaten aktualisieren den Zustand automatisch.
- Farben und Stärke verwenden die vorhandenen Designwerte; keine neue Abhängigkeit.

## Prüfung
- Lokalprognose und Wetterkarte Region auf Smartphone-Breite sowie Desktop testen.
- Anfang, Zwischenposition, Ende und Bereiche ohne Überlauf kontrollieren.
- Sicherstellen, dass Tippen, horizontales Wischen und automatische Sprünge weiterhin funktionieren.

## Nicht im Umfang
- Keine vertikalen Schatten in Warnungs- oder Push-Panels.
- Keine Änderung an Daten, Prognoselogik, Abständen oder Panelgrößen.
