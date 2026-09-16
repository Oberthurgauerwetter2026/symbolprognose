# Gewittersymbol nur bei echtem Gewitterpotenzial

## Problem (geprüft)
Ein Gewittersymbol entsteht heute schon aus sehr schwachen Signalen:
- Eine einzige Stunde mit Gewittercode und 0,1 mm Regen macht den ganzen Tag zum Gewittertag (`weather.ts`, Tagesaggregation).
- Ein einzelnes Modell (best_match oder DWD-MOSMIX) genügt, um eine Stunde auf Gewitter hochzustufen, sobald 0,5 mm Niederschlag dabei ist (Gewitter-Override in `weather.ts`).
- Der Plausibilitätsfilter lässt Gewitter bereits bei 0,5 mm oder 40 % Regenwahrscheinlichkeit stehen; ein Mass für Gewitterpotenzial (Labilität) wird bisher gar nicht abgefragt.
- MeteoSchweiz-Pictogramme 12/13/24/25 werden 1:1 als Gewitter übernommen, ohne Gegenprobe.

## Lösung
1. **Neue Grundlage: Gewitterpotenzial mitliefern**
   - Im Wetterdaten-Import zusätzlich die Labilitätswerte (CAPE, Lifted Index) und die Schauerspitzen abfragen und im Cache mitspeichern.
   - Fehlt der Wert bei einer Quelle, wird der bisherige Weg genutzt, damit nichts ausfällt.

2. **Stundenprognose: Gewitter braucht ein echtes Signal**
   - Ein Gewittersymbol bleibt nur, wenn Labilität vorhanden ist (CAPE ab ca. 150 J/kg bzw. negativer Lifted Index) UND Niederschlag von mindestens ca. 0,5 mm oder eine hohe Schauerspitze.
   - Sonst wird auf Schauer bzw. Regen zurückgestuft (nicht auf „trocken“, wenn Niederschlag da ist) und das MeteoSchweiz-Pictogramm entsprechend angepasst.

3. **Quellen müssen sich einiger sein**
   - Die Hochstufung auf Gewitter erfolgt nur, wenn zwei Quellen dieselbe Stunde als Gewitter sehen oder die Hauptquelle selbst Gewitter zeigt und die Labilität passt.
   - Vereinzelte Ausreisser eines Modells stufen nicht mehr hoch.

4. **Tagessymbol strenger**
   - Gewitter als Tagessymbol erst ab 2 Gewitterstunden mit Niederschlag und ausreichender Labilität; darunter bleibt das Schauer-/Regensymbol.
   - Die bestehende Regel „trockene Mehrheit = trockenes Symbol“ bleibt unverändert.

5. **Überall gleich**
   - Dieselbe Entscheidung gilt für Lokalprognose (kompakt und vollständig), Wetterkarte Region und die statischen Einbettungen, damit alle Ansichten dasselbe Symbol zeigen.

## Prüfen
- Ein Tag mit leichtem Regen ohne Labilität: kein Blitzsymbol, sondern Regen/Schauer.
- Ein echter Gewittertag mit hoher Labilität und Schauerspitzen: Blitzsymbol bleibt.
- Stundenprognose, Tageskacheln, Regionskarte und Einbettung gegenprüfen.

## Technische Details
- `scripts/ingest_openmeteo.py`: phaseA-Hourly um `cape`, `lifted_index`, `precipitation` q-Spitzen erweitern; Cache-Schema und Symbol-Cache-Writer entsprechend ergänzen.
- `src/lib/weather.ts`: `overlayThunder` auf Quellen-Konsens plus Labilitätsgate umstellen; Tagesaggregation `thunderHours >= 2` und Labilitätsbedingung; Downgrade auf 80/81/82 statt 95.
- `src/lib/forecast-aggregated.functions.ts`: `dropImplausibleWetCodes` um ein Gewitter-Gate (CAPE/Lifted Index, Niederschlagsspitze) erweitern und Gewittercodes auf Schauercodes zurückstufen statt zu löschen; `weathercode_mch` bei zurückgestuften Stunden auf ein Schauer-Pictogramm setzen.
- `src/components/weather-icons/index.tsx` und `src/lib/weather-icon-svg.server.ts`: Tages-Gewitterzweig an dieselbe Schwelle (`thunderHours >= 2`) binden, damit Client und serverseitige SVGs identisch entscheiden.
- Cache-Buster in `src/components/weather-widget.tsx` erhöhen, damit alte Prognosen im Browser nicht weiterleben.
