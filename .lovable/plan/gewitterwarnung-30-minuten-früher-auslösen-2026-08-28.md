# Gewitterwarnung 30 Minuten früher auslösen

## Befund (geprüft)

Die Automatik warnt heute erst, wenn die Intensität **innerhalb** der Gemeinde gemessen wird: `scripts/ingest_radar.py` schreibt je Gemeinde nur die Werte im Gemeindeumriss (`mmh`, `mmhArea`), und `src/lib/auto-thunder.server.ts` stuft daraus ein. Die Verlagerung (`motion`: Richtung + km/h) wird bereits berechnet, aber nur für den Satz „Zellen ziehen mit … km/h aus …“ im Warntext verwendet — nicht für die Auslösung. Zusammen mit der Bestätigung über zwei Radarläufe erreicht die Warnung die Nutzer deshalb erst, wenn das Gewitter schon da ist.

## Änderung

1. **Vorlauf-Fenster statt Gemeindefläche.** Der Radar-Ingest prüft je Gemeinde zusätzlich das Gebiet, aus dem die Zelle heranzieht: das Gemeinderaster wird entgegen der Zugrichtung um die Strecke verschoben, die die Zelle in 30 Minuten zurücklegt (Zuggeschwindigkeit × 30 Min.), und dort wird dieselbe flächengestützte Intensität ermittelt. Damit wird eine Gemeinde gewarnt, sobald die Zelle rund 30 Minuten entfernt ist.
2. **Korridor, nicht Punkt.** Ausgewertet wird der ganze Anflugkorridor (Verschiebungen von ca. 10 bis 35 Minuten Vorlauf), damit auch Zellen erfasst werden, die zwischen zwei Läufen ein Stück weiterziehen — und damit ein leicht abweichender Winkel die Warnung nicht verhindert.
3. **Warntext mit Zeitangabe.** Wird die Warnung durch den Anflug ausgelöst, steht im Text: „Zellen ziehen mit rund X km/h aus Y heran und erreichen die Region in etwa Z Minuten.“ Ist die Zelle bereits über der Gemeinde, bleibt der Text wie heute.
4. **Gültigkeit passend zum Vorlauf.** `valid_to` verlängert sich von 45 auf 75 Minuten, damit die Warnung während des Vorlaufs plus Durchzug gültig bleibt und nicht vorzeitig automatisch endet.
5. **Bestätigung bleibt unverändert** (Stufe 2: zwei Läufe, Stufe 3: drei Läufe, Fenster 15 Minuten) — der Vorlauf gleicht die Verzögerung aus. Schwellen (25 / 45 mm/h), Mindestfläche, Push-Sperre (30 Min.) und das automatische Beenden bleiben ebenfalls gleich.
6. **Ohne verlässliche Verlagerung** (keine Bewegungsschätzung, Geschwindigkeit unter 5 oder über 120 km/h) verhält sich die Automatik exakt wie heute: Auslösung nur bei Messung über der Gemeinde. Kein Fehlerfall.

## Technische Details

- `scripts/ingest_radar.py`, `write_region_max()`: aus `motion` (`dirFromDeg`, `kmh`) den Verschiebungsvektor in Rasterzellen berechnen und je Gemeinde für Vorlaufstufen (10/20/30/35 Min.) die `MIN_CELL_PIXELS`-höchste Intensität im verschobenen Maskenbereich bestimmen. Neue Felder pro Region: `mmhLead` (höchster Wert im Korridor) und `leadMin` (Vorlauf des Treffers). `RADAR_INGEST_VERSION` auf `v29-lead30` anheben, `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` mit.
- `src/lib/openmeteo-cache.server.ts`: Regions-Typ um `mmhLead?: number` und `leadMin?: number` erweitern.
- `src/lib/auto-thunder.server.ts`: Stufenentscheid auf `Math.max(mmhArea, mmhLead)`; bei Auslösung durch `mmhLead` den Zeitsatz aus `leadMin` ergänzen; `valid_to` auf 75 Minuten. Für den Textwert `peak` weiterhin die gemessene Spitze verwenden — bei reiner Anflugwarnung die Spitze aus dem Anflugfenster.
- `src/routes/admin-warnungen.tsx`: Hinweistext auf „warnt rund 30 Minuten vor Eintreffen (Anflug aus der Zugrichtung), bestätigt durch zwei Radarläufe“.
- Wirksam nach Deploy plus einem Radar-Ingest-Lauf (5-Minuten-Takt); bis dahin greift der unveränderte Rückfall.
