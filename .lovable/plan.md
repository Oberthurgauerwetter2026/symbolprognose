## Plan

Aktuell kann der Sonnen-Override (Codes 2/3 → klar/heiter, wenn `sunshineRatio` hoch) ein Tages-Symbol auch dann „aufhellen", wenn innerhalb 06–21 Uhr Niederschlag gefallen ist. Das soll unterbunden werden: **fällt im Aggregationsfenster spürbarer Regen, darf das Symbol nicht zu Sonne/heiter überstimmt werden.**

### Änderung

In `WeatherIcon` (`src/components/weather-icons/index.tsx`) den Sonnen-Override zusätzlich an „kein/kaum Regen" knüpfen:

- **Daily-Scope:** Sonnen-Override nur wenn `precipHours < 1` UND `precip < 0.5 mm`.
- **Hourly-Scope:** Sonnen-Override nur wenn `precip < 0.1 mm` UND `precipProb < 40 %`.

Codes für Schauer/Regen/Schnee/Gewitter sind nicht betroffen — der Override greift ohnehin nur bei trockenen Bewölkungs-Codes (2/3).

### Auswirkung

- Tage mit z. B. 8 h Sonne, aber 2 h leichtem Regen zwischen 06–21 zeigen weiterhin Wolken/Schauer statt einer Sonne.
- Reine Hochnebel-/Cirrus-Tage ohne Regen bleiben wie gewünscht „heiter".