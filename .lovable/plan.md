## Ziel

Auf der Regionskarte im **stündlichen** Modus soll der Wechsel zwischen Sonne und Mondsichel exakt am realen Sonnenauf-/-untergang erfolgen — nicht mehr an der starren Schwelle 06:00/20:00 Uhr.

## Aktueller Zustand

`src/components/region-map.tsx` Zeile 574:
```ts
const isDay = hourOfDay >= 6 && hourOfDay < 20;
```

Dieser globale Wert wird in jeden `SpotMarker` gereicht und entscheidet (im hourly-Mode) zwischen Tag-/Nacht-Icon. Im daily-Mode ist `effectiveIsDay = true` — das bleibt unverändert.

`data.daily.sunrise[]` und `data.daily.sunset[]` (ISO-Strings, lokal) sind pro Spot bereits im aggregierten Forecast vorhanden.

## Änderung

### `src/components/region-map.tsx`

1. **Globalen `isDay` entfernen** (wird nur noch als Fallback gebraucht, wenn keine Sunrise-Daten vorliegen).
2. **In `SpotMarker`** bei `mode === "hourly"` Tag/Nacht aus den realen Sonnenzeiten des angezeigten Tages bestimmen:

   ```ts
   function computeIsDay(absoluteHour: number, dayIdx: number, daily): boolean {
     const sr = daily.sunrise?.[dayIdx];
     const ss = daily.sunset?.[dayIdx];
     if (!sr || !ss) return hourOfDay >= 6 && hourOfDay < 20; // Fallback
     // Stunde innerhalb des Tages, an dem absoluteHour liegt
     const base = new Date(); base.setHours(0,0,0,0);
     const t = new Date(base.getTime() + absoluteHour * 3600_000).getTime();
     return t >= new Date(sr).getTime() && t < new Date(ss).getTime();
   }
   ```

   Verwendet wird die Sunrise/Sunset desjenigen Tages, der gerade angezeigt wird (`Math.floor(absoluteHour/24)`).

3. **`effectiveIsDay`** im hourly-Mode auf das Ergebnis von `computeIsDay` setzen; daily-Mode bleibt `true`.
4. **Props-Anpassung**: `isDay` wird nicht mehr von außen an `SpotMarker` gereicht (wird intern aus Daten + `absoluteHour` berechnet); die `RegionMap`-Übergabe an `SpotMarker` wird entsprechend reduziert. Die Memo-Dependency-Liste wird angepasst.

## Out of Scope

- Daily-Modus (immer Sonne).
- Andere Karten/Widgets (Lokal/Wind/Niederschlag) — bei Bedarf in separatem Schritt.
