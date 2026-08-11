# Lokalprognose: letzter Tag erscheint doppelt

## Was geprüft wurde

Die Serverantwort für Amriswil (heute, 11.8.) liefert:

- Tageskacheln (oben): 9 Tage im Datensatz, angezeigt werden die ersten 7 → Di 11.8. bis Mo 17.8.
- Stundenreihe (unteres Panel): Stundenwerte bis **20.8.**, also rund 3 Tage über die Tageskacheln hinaus.

Das untere Panel begrenzt seine Slots nicht auf die angezeigten 7 Tage. Wenn man bis ans Ende scrollt, laufen die Stunden über Montag hinaus weiter (18./19./20.8.). Die Kopfzeile des Panels kann diesen Tagen keinen Tag aus der Kachelreihe zuordnen und bleibt auf „Montag“ stehen — es entsteht der Eindruck, der letzte Tag (Montag) sei doppelt vorhanden.

## Änderung

1. Die Slot-Liste des unteren Panels auf den Zeitraum der angezeigten Tage begrenzen: alle Stunden nach dem Ende des letzten Kacheltags (Mo 23:00) werden nicht mehr gerendert.
2. Damit endet das Panel genau mit dem letzten Tag der Kachelreihe; Kopfzeile, Tages-Zusammenfassung und Scroll-Synchronisation bleiben konsistent.
3. Keine Änderung an Datenquellen, Aggregation oder Prognosehorizont — nur die Darstellung wird beschnitten.

## Technische Details

- `src/components/weather-widget.tsx`: im `allHourly`-Memo eine Obergrenze aus dem letzten Eintrag von `days` (`daily.time.slice(0, 7)`) ableiten und Slots mit späterem Zeitstempel überspringen. Das Memo bekommt `days` als Abhängigkeit.
- Kein Eingriff in `DetailPanel`-Logik nötig, da Scroll-Tracking und Tageswechsel-Trenner aus derselben Slot-Liste kommen.

## Alternative (falls gewünscht)

Statt zu beschneiden könnten die Kacheln auf 9 Tage erweitert werden, damit die vorhandenen Stunden bis 20.8. sichtbar bleiben. Standard bleibt die 7-Tage-Darstellung.
