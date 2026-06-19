## Recherche-Befund

Die führenden europäischen Wetterdienste (MeteoSchweiz, Yr.no, Meteoblue) verwenden ein **Zwei-Schichten-Säulen-Modell**:

- **Opake Säule** = erwartete Regenmenge (mm, Median)
- **Transparente/hellblaue Erweiterung darüber** = Unsicherheit / Restrisiko (Q10–Q90-Ensemble bzw. min–max-Intervall)
- "0 mm aber 24 % Wahrscheinlichkeit" wird **explizit** als nur-transparente Säule dargestellt → klares Signal "kein sicherer Regen, aber Restrisiko"
- Schwelle: transparente Säule ab jedem Wert > 0, opake ab jeder mm > 0
- Quellen u. a. MeteoSchweiz-Blog Nov 2025, Yr.no Help Center, Meteoblue Spec, Nightingale DVS Dark-Sky-Analyse

Consumer-Apps (Apple, AccuWeather) nutzen stattdessen reine %-Balken; das ist intuitiver für Laien, verliert aber die Menge.

Da unser Datenstrom Open-Meteo + MeteoSchweiz ist und exakt zur MCH-Konvention passt, übernehmen wir das **MeteoSchweiz/Yr.no-Schema** (Menge + Unsicherheit).

## Fix: `DayRainSparkline` in `src/components/weather-widget.tsx`

Pro 3h-Bucket zwei gestapelte Rechtecke im selben grauen Track:

```text
┌────────┐   100 %
│░░░░░░░░│   ← transparente Säule, Höhe ∝ prob  (hellblau, ~0.25 Opacity)
│░░░░░░░░│
│████████│   ← opake Säule, Höhe ∝ mm           (--wx-rain, 1.0 Opacity)
└────────┘   0 %
```

Konkret:

1. **mm-Säule** (opak): wie bisher, Höhe `(mm / scale) * 100 %`, `scale = max(2, maxMm * 1.1)`. Min 6 %, bei `mm == 0` keine opake Säule.
2. **Wahrscheinlichkeits-Säule** (transparent, **darüber** gestapelt): Höhe `max(mmHeight, prob %)` minus `mmHeight`, d. h. wir füllen den Track vom Top der mm-Säule bis zu `max(mmHeight, prob %)` mit `bg-[var(--wx-rain)]` und `opacity 0.25`. Sichtbar ab `prob >= 5 %`.
3. **Schwelle gesenkt** auf `prob >= 5` (statt 30/10), denn die transparente Schicht ist visuell zurückhaltend genug, um auch sehr niedrige Wahrscheinlichkeiten anzuzeigen ohne zu „schreien".
4. **Tooltip** erweitern: `"12–15 Uhr · 0.0 mm · 24 % Wahrscheinlichkeit"` bleibt; zusätzlich am Anfang der Sparkline beim Wochenkacheln-Layout unverändert.
5. **Legende** (Footer-Zeile bei `mm · %`, Zeile ~1276) ergänzen: ein kleiner Doppelbalken-Indikator (opak + transparent) mit Label `mm (sicher) · % (Risiko)`.

Keine Datenpipeline-Änderung, kein `FORECAST_VERSION`-Bump, kein Aggregations-Code. Rein Präsentation.

## Geltungsbereich

- Die analoge Logik wird auch im großen Stunden-Detail (Zeilen ~1075–1110, `perHour`-Map) konsistent gespiegelt: dort heute bereits opake Säule mit Opacity-Modulation via prob; wir lassen das unverändert, da dort die Werte deutlich detaillierter sind und die jetzige Lösung bereits sichtbare Hinweise gibt.

## Prüfung

`/karten/lokal?lat=47.5428&lon=9.2871&name=Amriswil` — heute (0 mm, 24 %) zeigt 8 niedrige, hellblau-transparente Säulen (~24 % Höhe); an Tagen mit Regen volle opake Säulen, ggf. mit transparenter Erweiterung wenn prob > mm-relative Höhe. Tooltip nennt mm + %.

## Quellen

- [MeteoSchweiz: Probabilistische Niederschlagsprognosen (Nov. 2025)](https://www.meteoschweiz.admin.ch/ueber-uns/meteoschweiz-blog/de/2025/11/wie-interpretiere-ich-probabilistische-niederschlagsprognosen.html)
- [Yr.no Help: Weather Forecasts and Uncertainty](https://hjelp.yr.no/hc/en-us/articles/4402772811026-Weather-forecasts-and-uncertainty)
- [Meteoblue: Precipitation Specification](https://content.meteoblue.com/en/research-education/specifications/weather-variables/precipitation/)
