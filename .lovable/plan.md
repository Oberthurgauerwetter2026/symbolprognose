## Problem

Der Server-Fn liefert jetzt bei fehlenden Datenquellen ein leeres Payload (`frames: []`, `warning: "…"`) statt zu werfen. Im Client (`src/components/maps/radar-map.tsx`) greift keine der drei Render-Zweige:

- `isLoading` → nein (Query aufgelöst)
- `error` → nein (kein Throw mehr)
- `data && frames.length > 0` → nein (leer)

→ Es wird gar nichts angezeigt.

## Fix

In `src/components/maps/radar-map.tsx` einen vierten Zweig neben dem bestehenden Loading/Error-Block ergänzen (ca. Zeile 2466):

```tsx
{data && frames.length === 0 && (
  <p className="text-center text-xs text-neutral-600">
    {data.warning ?? "Radardaten sind derzeit nicht verfügbar."}
  </p>
)}
```

Damit sieht der Nutzer den Grund (Open-Meteo/MCH temporär offline), und React-Query versucht es beim nächsten Refetch automatisch erneut.

## Scope

- Nur Frontend, nur `src/components/maps/radar-map.tsx`.
- Kein Backend-, Ingest- oder Renderlogik-Change.
