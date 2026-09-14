# GPS-Ortung der Lokalprognose präzisieren

## Ziel
Die Lokalprognose soll bei automatischer Standortbestimmung und beim Ortungs-Button eine möglichst genaue Geräteposition verwenden. Die Wetterprognose nutzt diese Koordinaten bereits direkt; eine Zuordnung zu einem groben Standardort ist nicht nötig.

## Umsetzung
- Eine gemeinsame Ortungsfunktion für automatische Erkennung und Ortungs-Button einführen.
- Hohe Genauigkeit ausdrücklich anfordern und veraltete Standortwerte bei einer neuen Ortung vermeiden.
- Nicht den ersten groben Treffer sofort übernehmen: während eines kurzen Zeitfensters bessere Messungen sammeln und den Treffer mit dem kleinsten Genauigkeitsradius verwenden.
- Bei bereits guter Genauigkeit die Ortung früh beenden, damit die Prognose schnell erscheint.
- Den bisherigen gespeicherten Ort nur als schnellen Startwert verwenden; im Hintergrund erneut präzise orten, statt dessen Zeitstempel bei jedem Öffnen dauerhaft zu verlängern.
- Fehler und Zeitüberschreitungen sauber behandeln: Wenn keine bessere Position verfügbar ist, den besten gültigen Treffer verwenden; andernfalls bleibt die Ortssuche verfügbar.
- Laufende Ortungsbeobachtung zuverlässig stoppen, damit Akku und Browserressourcen nicht unnötig belastet werden.

## Technische Details
- `navigator.geolocation.watchPosition` mit `enableHighAccuracy: true`, `maximumAge: 0` und begrenztem Timeout verwenden.
- `coords.accuracy` vergleichen; Zielwert etwa 100 Meter, mit kurzer maximaler Nachmessdauer.
- Koordinatenbereich und endliche Werte vor Übernahme prüfen.
- Reverse-Geocoding bleibt nur für den Anzeigenamen zuständig; die Prognose erhält weiterhin die präzisen GPS-Koordinaten.
- Verhalten auf Seite und WordPress-Embed angleichen, soweit der einbettende Browser Standortzugriff erlaubt.

## Prüfung
- Automatische Ortung und Ortungs-Button auf Mobil- und Desktopgrösse testen.
- Prüfen, dass ein späterer genauerer Treffer den groben Ersttreffer ersetzt.
- Prüfen, dass Abbruch, verweigerte Berechtigung und Timeout die Lokalprognose nicht blockieren.
- Typecheck, Build und Browserprüfung durchführen.
