## Problem

`weathercode` wird in `src/lib/weather.ts` an zwei Stellen numerisch verrechnet:

1. **Ensemble-Mittel** (Z. 354): `Math.round(sum / count)` über alle Mitglieder eines Modells.
2. **Tages-Aggregation** (Z. 496): `median` der stündlichen Codes.

WMO-Codes sind aber **kategorial** (3=bedeckt, 61–65=Regen, 71–77=Schnee, 80–82=Schauer, 95+=Gewitter). Arithmetik darauf erzeugt sinnlose Zwischenwerte — z. B. Amriswil Di: ICON-CH2=80, ECMWF=55 → ⌀ 68 → fällt in „Regen"-Bereich (61–67) → `IconRain` statt Schauer.

## Lösung

Beide Stellen durch eine kategoriale Modus-Funktion ersetzen.

### Neue Helper in `src/lib/weather.ts`

```ts
// Kategorie pro WMO-Code (höhere Zahl = "nasser/schwerer" für Tie-Break)
function wmoCategory(code: number): number {
  if (code >= 95) return 9;          // thunder
  if (code >= 71 && code <= 77) return 8;  // snow
  if (code === 85 || code === 86) return 8;
  if (code >= 61 && code <= 67) return 7;  // rain
  if (code === 82) return 7;               // schwerer Schauer ~ Regen
  if (code === 80 || code === 81) return 6; // shower (leicht/mäßig)
  if (code >= 51 && code <= 57) return 5;  // drizzle
  if (code === 45 || code === 48) return 4; // fog
  if (code === 3) return 3;                // cloudy
  if (code === 2) return 2;                // partly
  if (code === 1) return 1;                // mostly clear
  return 0;                                 // clear
}

// Repräsentativen Code per Modus wählen.
// Tie-Break 1: "nassere/schwerere" Kategorie gewinnt (höhere wmoCategory).
// Tie-Break 2 (optional, nur Daily): bei precipHours < 8h Schauer-Kategorie (6)
//   gegenüber Regen-Kategorie (7) bevorzugen.
function representativeWeathercode(
  codes: number[],
  opts?: { preferShower?: boolean }
): number | null {
  const valid = codes.filter((c) => Number.isFinite(c));
  if (!valid.length) return null;
  const catCount = new Map<number, number>();
  const codeCount = new Map<number, number>();
  for (const c of valid) {
    const cat = wmoCategory(c);
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    codeCount.set(c, (codeCount.get(c) ?? 0) + 1);
  }
  // Best category: höchste Häufigkeit, bei Gleichstand höhere Kategorie (nasser).
  let bestCat = -1, bestCount = -1;
  for (const [cat, n] of catCount) {
    if (n > bestCount || (n === bestCount && cat > bestCat)) {
      bestCat = cat; bestCount = n;
    }
  }
  // Optionaler Schauer-vor-Regen-Override (Daily).
  if (opts?.preferShower && bestCat === 7) {
    const showerN = catCount.get(6) ?? 0;
    if (showerN >= bestCount - 1) bestCat = 6;
  }
  // Häufigsten Original-Code innerhalb der gewählten Kategorie zurückgeben.
  let bestCode = valid[0], bestN = -1;
  for (const [c, n] of codeCount) {
    if (wmoCategory(c) !== bestCat) continue;
    if (n > bestN) { bestCode = c; bestN = n; }
  }
  return bestCode;
}
```

### Anpassungen

**`fetchEnsembleMean` (~Z. 343–355)**
Für `v === "weathercode"` pro Zeitschritt `representativeWeathercode([...members at index i])` statt `Math.round(sum / count)`. Restliche Variablen bleiben arithmetisches Mittel.

**`aggregateDailyFromHourly` (~Z. 496)**
- `weathercode: representativeWeathercode(finite(h.weathercode), { preferShower: precipHours < 8 })` statt `median(...)`.
- `precipHours` wird ohnehin schon vorher berechnet (Z. 494).

## Ergebnis

- Mittelung von „Schauer (80)" + „Niesel (55)" ergibt nicht mehr fälschlich „Regen (68)", sondern die häufigere/schauer-artige Kategorie.
- Tagessymbol Amriswil Di → Code 80 → `IconDrizzle` (Schauer) statt `IconRain`.
- Stündliche Symbole bleiben korrekter (Ensemble-Modus statt Pseudo-Mittel).
- Schnee/Gewitter werden durch Tie-Break nicht „weggemittelt", wenn nur ein Modell sie meldet — aber nur, wenn sie tatsächlich häufig genug auftreten (kein einzelner Ausreißer-Member dominiert).
