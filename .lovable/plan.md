# Regionskarte: Warnungen an den gewählten Zeitpunkt binden

## Ziel
Die angezeigten Warnungen sollen zum gewählten Zeitschritt passen — im Stundenmodus zur gewählten Stunde, im Tagesmodus zum gewählten Tag. Warnungen, deren Zeitfenster für den betrachteten Zeitpunkt bereits abgelaufen ist, verschwinden; noch kommende Warnungen erscheinen, sobald der betrachtete Zeitraum sie abdeckt (Vorlaufzeit bleibt sichtbar).

## Verhalten
- Stundenmodus: Warnung anzeigen, wenn ihr Zeitfenster die gewählte Stunde überlappt; nie, wenn sie vor der gewählten Stunde endet.
- Tagesmodus: Warnung anzeigen, wenn ihr Zeitfenster den gewählten Tag (00:00–24:00) überlappt. Beim heutigen Tag zählt nur noch der Zeitraum ab jetzt, damit heute schon abgelaufene Warnungen nicht mehr erscheinen.
- Betrifft Marker-Symbole, die Warnstufen der Region und das Warn-Banner.
- Der Minutentakt-Ticker bleibt, damit Ablauf ohne Neuladen greift.

## Technisch
In `src/components/region-map.tsx` wird der `activeWarnings`-Filter von „jetzt“ auf ein aus `viewMode`, `absoluteHour` bzw. `selectedDayIdx` abgeleitetes Zeitfenster umgestellt und als Intervall-Überlappung (`validFrom < fensterEnde && validTo > fensterStart`) geprüft, mit `nowMs` als Untergrenze für den aktuellen Tag/die aktuelle Stunde. Keine Backend-Änderungen.
