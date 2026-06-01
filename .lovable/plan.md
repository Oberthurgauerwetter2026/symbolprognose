Ich habe gesehen: Die Icon-Komponente wurde zwar angepasst, aber die Tagesdaten selbst wählen weiterhin oft einen pessimistischen Tages-WMO-Code, weil die Aggregation den kategorialen Modus nimmt und bei Gleichstand die nassere Kategorie bevorzugt.

Plan:

1. `src/lib/weather.ts` anpassen
   - Die Tagesaggregation in `aggregateDailyFromHourly` so ändern, dass ein Tag mit Regen erst ab genügend Regenstunden oder relevanter Menge als Regen-/Schauertag dominiert.
   - Bei Regen erst ab Nachmittag bzw. kurzen Schauern den Tagescode eher als Schauer statt Dauerregen behandeln.
   - Bei mehreren trockenen/sonnigen Stunden den Tagescode nicht mehr allein durch ein paar nasse Stunden auf Regen kippen lassen.

2. `src/components/weather-icons/index.tsx` feinjustieren
   - Die verbleibende Tages-Override-Schwelle bei `dayHasRain` ebenfalls von `0.3` auf `0.25` vereinheitlichen.
   - Optional eine zusätzliche Regel ergänzen: kurzer Tagesregen + Sonne → `IconSunShower`, unabhängig davon, ob der Tages-WMO-Code schon nass ist.

3. Ergebnis prüfen
   - Sicherstellen, dass die Tageskacheln und Kartenmarker beide dieselbe Logik bekommen.
   - Erwartung für Dienstag: nicht mehr reines Regen-/Drizzle-Symbol, sondern Schauer-mit-Sonne, wenn erst ab Nachmittag Regen fällt und vorher Sonne vorhanden ist.
   - Dauerregen-Tage mit vielen Regenstunden und höherer Summe bleiben weiterhin Regen.