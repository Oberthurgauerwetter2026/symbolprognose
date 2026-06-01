## Neues Icon „Sonne + Wolke + Schauer + Blitz"

**`src/components/weather-icons/index.tsx`**

1. Neues Icon `IconSunThunder`: Sonne (oben links), Wolke (Mitte), 1 Tropfen, Blitz — aus vorhandenen Sub-Primitiven `Sun`, `Cloud`, `Drop`, `Bolt`.

2. Daily-Override-Logik dreistufig (ersetzt aktuellen `thunderHours ≥ 1 → IconThunderstorm`-Block):
   - **Vollgewitter** (`IconThunderstorm`): `thunderHours ≥ 2` ODER (`thunderHours ≥ 1 && precip ≥ 8`) ODER (`code ∈ {95,96,99} && precipHours ≥ 3`).
   - **Gewitter-Schauer mit Sonne** (`IconSunThunder`): sonst, wenn `thunderHours ≥ 1` UND `sunshineRatio ≥ 0.15` UND `precipHours < 8`.
   - **Restliche Gewitter-Stunden ohne Sonne**: `IconThunderstorm`.
   - Sonst fällt es durch in die bestehende Sonne/Schauer-Logik (`pickWetDailyIcon`).

**`src/lib/weather.ts`, `fetchForecast`**

3. Gewitter-Overlay aus best_match/MOSMIX nur übernehmen, wenn an dieser Stunde `merged.hourly.precipitation[i] ≥ 2 mm` — verhindert Geisterblitze.

**Kein Cache-Bump.**

**Verifikation:**
- Amriswil/morgen (1h Gewitter mit ~5 mm + viel Sonne) → IconSunThunder.
- Tag mit 3h Gewitter / Dauerregen → IconThunderstorm.
- Schauertag ohne Gewitter → IconSunShower (unverändert).
