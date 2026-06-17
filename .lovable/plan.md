## Ziel

Wenn der MCH-Original-Icon-Code vorhanden ist (`weathercode_mch`, 1–35 Tag / 101–135 Nacht), soll er die Icon-Wahl im Widget direkt bestimmen — nicht erst über den WMO-Umweg und nur als Tag/Nacht-Flip.

## Status heute

- Ingest behält `weathercode_mch` korrekt (1–35 / 101–135).
- Frontend reicht `mchCode` bis in `<WeatherIcon>` durch.
- Aber: Icon-Auswahl läuft weiterhin über `code` (WMO), das aus `MCH_ICON_TO_WMO` gemappt wird (mit Fallback „bewölkt"). `mchCode` beeinflusst nur `isDay`.

Folge: MCH-Differenzierungen wie 6 (Schnee-Regen-Mix), 8, 10, 18, 22, 28/29 (variabel), 31/33/35 (Sturm) gehen verloren, weil sie im WMO-Mapping flachgedrückt werden. WMO-MApping entfernen und nur MCH-Codes verwenden

## Plan

1. **Direkten MCH→Icon-Dispatcher einbauen**
  - Neue Funktion `pickMchIcon(mchBase, isDay, props, ctx)` in `src/components/weather-icons/index.tsx`.
  - `mchBase` ist `mchCode % 100` (Tag/Nacht-Spiegelung), `isDay` schon korrekt gesetzt.
  - Mapping pro MCH-Nummer auf bestehende `Icon*`-Komponenten:
    - 1 → Clear / ClearNight
    - 2, 26 → MostlyClear
    - 3, 27, 28, 29 → PartlyCloudy
    - 4 → PartlyCloudy bzw. Cloudy je nach Bedeckung
    - 5 → Cloudy
    - 30 → Fog
    - 6, 14, 21 → Drizzle
    - 15 → Rain
    - 9, 11, 17, 19, 32 → Drizzle/Rain (Schauer) — bei Sonne `SunShower`
    - 7, 10, 16, 20, 22, 34 → Snow
    - 8, 18, 23 → Rain (Schnee-Regen-Mix als Rain)
    - 12, 13, 24, 25, 31, 33, 35 → Thunderstorm bzw. `SunThunder` bei Sonne; Schnee-Gewitter (z. B. 35 mit Schnee-Signal) → `SnowThunder`.
  - `sunshineRatio`, `precip`, `precipProb`, `isSnow` weiter als Kontext nutzen für Sun-Varianten und Schnee-Override.
2. **Dispatcher zuerst auslösen**
  - In `WeatherIcon` direkt nach dem `mchCode`-Day/Night-Flip: wenn `mchCode` gültig (`Number.isFinite`, `>= 1`), `pickMchIcon` aufrufen und Ergebnis zurückgeben.
  - Fällt `pickMchIcon` auf `null` (unbekannte Nummer), wie heute auf die WMO-Logik zurückfallen.
3. **Server-SVG-Pfad spiegeln**
  - Dieselbe MCH-Tabelle in `src/lib/weather-icon-svg.server.ts` einsetzen, damit die noscript-/Snapshot-Embeds dieselbe Symbolik liefern.
4. **Keine Änderung an Daten/Ingest**
  - `scripts/ingest_mch_local_forecast.py` bleibt unverändert: `weathercode_mch` (roh) und `weathercode` (WMO-Mapping) wie heute.
  - Kein neuer Workflow-Run nötig; das Frontend nutzt die schon vorhandenen Felder direkt.
5. **Geltungsbereich**
  - Stündliche Icons in `weather-widget.tsx` und `region-map.tsx` (beides schon `mchCode`-fähig).
  - Daily-Icons: nur dort umstellen, wo `daily.weathercode_mch` tatsächlich durchgereicht wird. Falls nicht, in einem kleinen Folgeschritt analog zur Hourly-Pipeline mitgeben (gleiche Felder existieren in `MchLocalForecastLocation.daily`).

## Erwartetes Ergebnis

- Symbol entspricht 1:1 dem MeteoSwiss-Icon, inkl. Sturm/Gewitter, Schauer, Schnee-Regen-Mix, Cirrus.
- Tag/Nacht-Flip kommt weiter direkt aus MCH (Code ≥ 100 = Nacht).
- WMO-Pfad bleibt als Fallback für Quellen ohne MCH-Code (Open‑Meteo) bestehen.