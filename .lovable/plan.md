# Scrollen im Warn-Info-Panel bei mehreren Warnungen

## Ziel
Wenn mehrere Warnungen für die gewählte Region aktiv sind, soll das Warn-Meldungsfenster im rechten Info-Panel scrollbar sein, damit die Inhalte nicht unendlich nach unten wachsen und abgeschnitten werden.

## Geplante Änderungen

### 1. Höhenlimit für das Info-Panel
- Datei: `src/components/maps/warn-map.tsx`
- Das rechte `aside` (Info-Panel) erhält eine maximale Höhe, die an die Kartenhöhe angeglichen wird (`h-[380px]` / `sm:h-[520px]` / `lg:h-[560px]`), und wird selbst flexibel scrollbar (`overflow-y-auto`) oder als Flex-Column aufgebaut, bei der nur die Warnliste scrollt.

### 2. Warnliste scrollbar machen
- Die `<ul>` mit den einzelnen Warnkarten wird in einen Wrapper mit `overflow-y-auto` und `flex-1` gesetzt.
- Header (Region, Auswahl aufheben) und Footer (Link oberthurgauerwetter.ch) sowie der Abonnieren-Block bleiben sichtbar und scrollen nicht mit.
- Auf mobilen Auflösungen (einspaltiges Layout) bleibt die bisherige Darstellung erhalten, aber die Liste wird ebenfalls scrollbar, wenn der Inhalt die verfügbare Höhe übersteigt.

### 3. Visuelle Scrollbar-Hinweise
- Falls nötig, leichter innerer Abstand (`pr-1`) am Listen-Wrapper, damit die Scrollbar nicht die Inhalte überdeckt.
- Keine zusätzlichen Änderungen an Farben, Inhalten oder Links.

## Nicht im Scope
- Keine Änderung der Karte, der Warnlogik, der Push-Benachrichtigungen oder des Textes.
- Keine neue Route oder API.

## Verifikation
- Vorschau der Warnkarte mit mehreren aktiven Warnungen öffnen (z. B. durch Auswahl einer Region mit mehreren Warnungen oder Testdaten).
- Screenshot prüfen: das Info-Panel zeigt eine Scrollbar und lässt sich nach unten scrollen, ohne dass der Footer oder Abonnieren-Block verschwindet.