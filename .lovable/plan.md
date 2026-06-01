## Problem

Das Tagesicon für Dienstag zeigt 3 Regentropfen (`IconDrizzle`), obwohl von 06–15 Uhr deutlich Sonne herrscht und Regen erst ab 18 Uhr einsetzt.

**Ursache** in `src/components/weather-icons/index.tsx` Z. 444:
```ts
if (code === 80 || code === 81) return <IconDrizzle {...props} />;
```
Für die WMO-Schauer-Codes 80/81 wird im `daily`-Scope **direkt** `IconDrizzle` zurückgegeben — ohne den Sonnen-Override, der für Code 82 (Z. 446–451) und für 61–67 (Z. 436–440) bereits existiert.

## Fix

Den gleichen Daily-SunShower-Pfad auch auf Codes **80/81** anwenden:

```ts
if (code === 80 || code === 81) {
  if (scope === "daily" && (sunshineRatio ?? 0) >= 0.3) {
    return <IconSunShower {...props} />;
  }
  return <IconDrizzle {...props} />;
}
```

Zusätzlich Schwelle auf **`sunshineRatio >= 0.25`** senken (an allen drei Stellen: Z. 381, 437, 447, neu 444). Begründung: Nenner ist 15 h; ein Tag mit ~4 h klarer Vormittagssonne (wie Dienstag) liegt bei ~0.27. 0.30 verfehlt das knapp.

## Geänderte Datei

- `src/components/weather-icons/index.tsx` — vier Stellen (Override-Block + 3 WMO-Branches).

## Erwartetes Ergebnis

Dienstag → `IconSunShower` (Sonne + Schauer) statt `IconDrizzle`. Reine Regentage (kaum Sonne, viele nasse Stunden) bleiben unverändert `IconRain`/`IconDrizzle`.
