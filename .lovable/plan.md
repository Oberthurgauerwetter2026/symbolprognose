**Befund**
- Die Radar-PNGs werden geladen, sind aber aktuell vollständig transparent: das geprüfte Bild `20260530T0400.png` hat `0` sichtbare Pixel.
- Die EPS-Manifestdaten sind vorhanden, werden aber nicht genutzt, weil sie zu alt sind (`generatedAt 2026-05-29T22:26Z`, älter als 6h). Deshalb fällt die App auf deterministische Open-Meteo-Prognose zurück.
- Zusätzlich ist der EPS-Lookup zeitlich zu strikt: EPS liefert nur volle Stunden, die 15-Minuten-Prognose wird aber komplett bis zum EPS-Horizont übersprungen. Dadurch kann bei alten/leeren EPS-Daten viel Prognosefläche unsichtbar bleiben.

**Plan**
1. **EPS-Freshness robuster machen**
   - Nicht nur `generatedAt`, sondern auch die Step-Zeiten prüfen.
   - EPS nur verwenden, wenn Forecast-Steps wirklich in der Zukunft liegen und ausreichend aktuell sind.

2. **Deterministischen Fallback nicht komplett wegschalten**
   - 15-Minuten-Open-Meteo-Frames nur dann durch EPS ersetzen, wenn für genau diese Stunde ein EPS-PNG existiert.
   - Zwischen EPS-Stunden bzw. bei stale/leerem EPS weiter Open-Meteo anzeigen.

3. **Leere EPS-Bilder ignorieren**
   - EPS-Steps mit `maxMmh <= 0` und `meanWetFrac <= 0` nicht als sichtbare Regenbilder behandeln.
   - So blockiert ein trockenes/kaputtes EPS-Manifest nicht die normale Prognose.

4. **UI-Hinweis verbessern**
   - Wenn das aktuelle Radarbild wirklich trocken ist, aber Prognose/Fallback aktiv ist, soll die Karte weiter sinnvoll steuerbar bleiben.
   - Optional kleine Warnung ausgeben, wenn echte Radar-PNGs geladen sind, aber im aktuellen Frame kein Niederschlag sichtbar ist.

**Ziel**
Die Karte zeigt wieder Regenbilder, sobald Radar oder Prognose Niederschlag enthält; leere Radar-/EPS-PNGs blockieren die Fallback-Prognose nicht mehr.