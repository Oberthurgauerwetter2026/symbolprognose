## Ziel

Drei kleine Korrekturen in Lokal- und Regionalprognose:

1. **Symbol-Bug am Mittwoch**: 06:00 und 09:00 zeigen ein Schnee-Symbol, obwohl 20 °C / 24 °C prognostiziert sind.
2. **Quellen-Footer** unten überarbeiten — alle tatsächlich benutzten Quellen sauber nennen.
3. **Ortserkennung**: aktueller Standort soll beim Aufruf zuverlässig automatisch erkannt werden.

---

## 1) Symbol-Fix (MCH-Pictogramm-Mapping)

Ursache: In `src/components/weather-icons/index.tsx` (`mchToIcon`, Zeilen ~408–465) werden die MCH-Codes **17–23** (Regen+Schnee-Mischformen, Schneeregenschauer, Schneeschauer) pauschal auf `IconSnow` gemappt. MeteoSwiss liefert diese Codes aus dem statistisch nachkalibrierten Punktmodell auch bei Plusgraden, sobald der Niederschlag in der Höhe als Schnee anfällt — am Boden ist es dann längst Regen. Das Widget hat aber `temperature_2m` daneben stehen und ignoriert es bisher beim Icon.

Fix:

- `WeatherIcon` bekommt ein optionales Prop `temp?: number` (gemessene/prognostizierte 2 m-Temperatur in °C).
- In `mchToIcon` wird vor dem `return <IconSnow />` ein Temperatur-Gate eingezogen:
  - Mischcodes (17, 18, 19, 21, 23) und Schauer-Schnee (11, 20, 22) → bei `temp > 2 °C` als Regen/Schauer rendern (`IconRain` bzw. `IconSunShower` tags), nicht als Schnee.
  - Reine Schnee-Codes (10, 14, 15, 16) → bei `temp > 4 °C` ebenfalls auf Regen herabsetzen (defensiv; bei echtem Schneefall liegt die Temperatur < 2 °C).
- Aufrufstellen versorgen das neue Prop:
  - `src/components/weather-widget.tsx` Zeile ~1114 → `temp={h.temperature_2m?.[idx]}`.
  - `src/components/region-map.tsx` Zeilen 224 + 408 → entsprechendes Temperaturfeld aus dem dort vorhandenen Forecast-Snapshot.
- Tagessymbole (Zeile 643) bleiben unverändert — Mittwochs Tag-Karte zeigt korrekt das Gewitter-Icon.

Ergebnis: 06:00 / 09:00 Mittwoch zeigen Regen-/Schauer-Icon statt Schnee. Bei echten Winter-Situationen ändert sich nichts.

## 2) Quellen-Footer

`src/components/weather-widget.tsx` Footer (Zeile 1455) und das Pendant in `src/components/region-map.tsx` (bzw. `region-map-template.tsx`) auf eine einheitliche, vollständige Quellenangabe umstellen:

```
MeteoSchweiz local_forecast (OGD, ICON-CH1/CH2-EPS) · DWD-MOSMIX (Tag 6–10) ·
Open-Meteo ICON-seamless (Karten & Niederschlag) · MeteoSchweiz CPC (Radar) ·
EUMETSAT MTG (Satellit) · Grafik © oberthurgauerwetter.ch
```

Genaue Formulierung wird im Build kompakt umgebrochen; nur die Lokal- und Regional-Footer werden angepasst, andere Karten bleiben unberührt.

## 3) Standort automatisch erkennen

Heute in `src/components/weather-widget.tsx` Zeilen 156–183: Auto-Geolocate läuft nur, wenn weder `initialLocation` noch ein gespeicherter Ort vorhanden ist. Folge: wer Amriswil einmal besucht hat, bekommt nie wieder eine Auto-Erkennung.

Anpassungen:

- Auto-Geolocate auch dann auslösen, wenn der gespeicherte Ort älter als **24 h** ist (Timestamp in `weather:location` ergänzen).
- Bei vorhandenem `initialLocation` aus der URL (`?lat=&lon=&name=`) weiterhin kein Auto-Trigger — das ist eine bewusste Auswahl.
- Sanftes Verhalten: erkennt der Browser den Standort, wird der bisherige Eintrag still überschrieben und `selectedDayIdx` auf 0 gesetzt; bei verweigerter Permission bleibt der gespeicherte Ort aktiv.
- Bestehender „Mein Standort"-Button (Zeile 538) bleibt für manuelle Auslösung.

Region-Prognose erbt das Verhalten automatisch, da sie denselben `WeatherWidget` einbettet.

## Technische Notizen

- Keine Änderungen an Ingest-Skripten, R2-Cache, Server-Funktionen oder Routing.
- `mchToIcon` bleibt rückwärtskompatibel: ohne `temp` exakt heutiges Verhalten.
- Temperatur-Gate verändert nur das Symbol, keine Zahlen, Bars oder Tooltips.

## Verifikation

- `bunx tsgo --noEmit`.
- Playwright-Screenshot von `/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` Tag „Mittwoch", 06:00 + 09:00 → Regen-/Schauer-Icon.
- Manuelles Stören (`localStorage.removeItem('weather:location')` + Reload ohne URL-Params) → Browser-Permission-Prompt erscheint.
- Sichtkontrolle Footer auf Lokal- und Regional-Seite.
