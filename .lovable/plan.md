## Fix: Wetterdaten laden nicht

**Ursache:** Open-Meteo lehnt `icon_ch1,icon_ch2` mit HTTP 400 ab (`Cannot initialize MultiDomains from invalid String value icon_ch1`). Die offiziellen Identifier für die MeteoSchweiz-Modelle bei Open-Meteo sind `meteoswiss_icon_ch1` und `meteoswiss_icon_ch2`. Zusätzlich: wenn beide Modelle gleichzeitig angegeben werden, werden alle Hourly/Daily-Felder pro Modell suffixiert (`temperature_2m_meteoswiss_icon_ch1`), was unseren Parser bricht.

## Lösung

In `src/lib/weather.ts`:

```ts
url.searchParams.set("models", "meteoswiss_icon_seamless");
```

`meteoswiss_icon_seamless` ist der offizielle nahtlose Blend von Open-Meteo aus **ICON-CH1-EPS** (Kurzfrist, ~1 km) und **ICON-CH2-EPS** (Mittelfrist, ~2 km). Liefert saubere Feldnamen ohne Suffix → keine weiteren Code-Änderungen nötig. Funktioniert für die geforderten 6 Tage.

In `src/components/weather-widget.tsx` Footer-Label bleibt bei „ICON-CH1-EPS / ICON-CH2-EPS" (sachlich korrekt, da seamless beide kombiniert).

## Geänderte Dateien

- `src/lib/weather.ts` — ein Parameter

Sonst nichts. Sehr kleiner, gezielter Fix.