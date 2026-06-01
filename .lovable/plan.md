## Problem
Im Tagesblock greift jetzt derselbe Override wie stündlich: `precipitation_sum` ist die **Tagessumme** (z. B. 3 mm aus einem 1-Stunden-Schauer) und triggert sofort das Regen-Icon für den ganzen Tag — auch wenn die übrigen 23 h trocken/sonnig sind. Die WMO-Tages-Codes von Open-Meteo unterscheiden bereits zwischen „Regen" (61–65) und „Schauer" (80–82); der Override macht diese Nuance kaputt.

## Lösung
Override nur für **stündliche** Icons. Für den Tagesblock dem `weathercode` vertrauen, optional mit `precipitation_hours` als Korrektiv.

### Änderungen

**`src/components/weather-icons/index.tsx`**
- Neue Prop `scope?: "hourly" | "daily"` (Default `"hourly"`).
- Override-Logik für Regen/Drizzle nur ausführen, wenn `scope === "hourly"`.
- Für `scope === "daily"` zusätzlich `precipHours` akzeptieren: Override greift nur, wenn `precipHours >= 6` (≈ ein Viertel des Tages) — verhindert „ganzer Tag Regen" bei kurzem Schauer.
- `isSnow`-Logik bleibt für beide Scopes (Schnee ist als Tagessignal robust).

**`src/components/weather-widget.tsx`**
- Daily-Aufruf (Zeile ~535): `scope="daily"` setzen und `precipHours={d.precipitation_hours?.[i]}` mitgeben.
- Hourly-Aufruf bleibt unverändert.

**`src/lib/weather.ts`**
- `precipitation_hours` zur Daily-Liste im Open-Meteo-Request ergänzen und als `number[]` durchreichen (analog zu `precipitation_sum`).

## Resultat
- Tageskachel zeigt bei kurzem Schauer das Modell-Symbol (z. B. „teils bewölkt mit Schauern"), nicht mehr Dauerregen.
- Stündliche Kacheln bleiben mit dem zuverlässigen Regen-Override.
- Schnee-Override bleibt überall aktiv.
