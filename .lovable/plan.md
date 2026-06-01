Ich habe die aktuellen Antworten geprüft: die Serverfunktion liefert echte Daten und Cloud-Felder, aber der Datenfluss ist weiterhin anfällig für alte/fehlende Werte. Hauptprobleme sind: fehlende Arrays werden beim Sanitizing zu leeren/0-Werten, Kacheln fallen hart auf `0°/0°` zurück, und die Karten-/Stundenanzeige nutzt keine zentrale Normalisierung pro Zeitpunkt.

Plan:

1. Daten-Normalisierung in `src/lib/weather.ts` reparieren
   - Alle Hourly-/Daily-Arrays auf die Zeitachsenlänge auffüllen, nicht nur vorhandene Werte mappen.
   - Fehlende numerische Werte nicht pauschal als echte `0` interpretieren, sondern aus Modell-/Fallbackdaten übernehmen oder als nicht verfügbar behandeln.
   - MOSMIX-Overwrite so ergänzen, dass Cloud-Felder aus der bestehenden Quelle erhalten bleiben und nicht indirekt als fehlend/0 enden.

2. Kachel-Fallbacks in `src/components/region-map.tsx` beheben
   - Marker erst als Wetter-Kachel rendern, wenn für den gewählten Tag/Stunde gültige Temperaturdaten vorhanden sind.
   - Keine `0°/0°`-Fallbacks mehr für fehlende Tagesdaten; stattdessen klarer Lade-/Keine-Daten-Zustand pro Ort.
   - Gemeinsame Auswahlfunktion für Tages-/Stundenwerte einführen, damit Code, Temperatur, Niederschlag, Sonne und Wolken konsistent aus demselben gültigen Index kommen.

3. Lokale Tages- und Stundenkacheln in `src/components/weather-widget.tsx` absichern
   - Tageskarten und Stundenprognose nur mit validen Werten rendern.
   - Fehlende Werte mit `–` anzeigen statt mit `0` oder veralteten Fallbacks.
   - Icon-Props nur mit echten Cloud-/Sunshine-Daten befüllen; fehlende Felder nicht als wolkenlos interpretieren.

4. Symbol-Klassifikation final härten
   - Trockene Stunden/Tage anhand Cloud-Low/Mid/High plus Sunshine korrigieren.
   - Nasse WMO-Codes nur dann als Regen/Nieselregen anzeigen, wenn Niederschlagsmenge/-stunden das stützen; sonst Sonnenschauer/teils bewölkt.

5. Cache-Version erhöhen und validieren
   - Forecast-Version auf `v6` setzen, damit Preview und Browser garantiert neue Query-Daten holen.
   - `/karten/region` und `/karten/lokal` im Preview prüfen: keine `0°/0°`-Kacheln mehr, fehlende Orte zeigen keinen falschen Wetterwert, und die Marker/Stunden nutzen Cloud/Sonnenschein sichtbar.