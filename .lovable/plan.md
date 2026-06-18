## Ursache

Die Regionskarte berechnet `effectiveIsDay` bereits korrekt aus den Sonnenauf-/-untergangs-Zeiten und reicht es als `isDay` an `WeatherIcon`. ABER: Wenn ein `mchCode` vorhanden ist, ignoriert der neue `mchToIcon`-Dispatcher das `isDay`-Prop komplett und leitet Tag/Nacht ausschließlich aus dem 100er-Offset des MCH-Codes ab (`isNight = mchCode >= 100`).

Im MCH-Stream können Nacht-Codes (101–135) auch noch in den ersten Stunden nach Sonnenaufgang vorkommen (Zeitraster, Zonengrenzen) — dadurch erscheint um 07:00 weiter die Mondsichel, obwohl die Sonne längst aufgegangen ist.

## Fix

### `src/components/weather-icons/index.tsx`

`mchToIcon` nimmt zusätzlich `isDay` entgegen. Wenn `isDay` explizit übergeben wurde, hat es Vorrang vor dem 100er-Offset:

```ts
function mchToIcon(mchCode: number, isDay: boolean | undefined, size?, className?) {
  const baseCode = mchCode >= 100 ? mchCode - 100 : mchCode;
  const isNight = typeof isDay === "boolean" ? !isDay : mchCode >= 100;
  // ... switch(baseCode) — wie bisher, mit isDay = !isNight
}
```

Der Aufruf in `WeatherIcon` reicht das `isDay`-Prop durch.

### `src/lib/weather-icon-svg.server.ts`

`renderMchIconSvg` analog: zusätzliches `isDay`-Argument, gleiche Vorrang-Regel. Aufruf in `renderWeatherIconSvg` reicht das berechnete `isDay` weiter.

## Out of Scope

- Keine Änderung an der MCH-Datenpipeline.
- Tag/Nacht-Logik bei den restlichen Komponenten bleibt unverändert (Icon-Katalog reicht weiter `isDay` via mchCode-Offset).
