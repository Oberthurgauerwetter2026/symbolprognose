## Änderungen

### 1. Radar: Prognose auf 32 Stunden kürzen

**`src/lib/radar.functions.ts`**
- Cutoff einführen: `forecastCutoff = now + 32 * 3600 * 1000`.
- Beim Aufbau der Future-Frames aus Phase 1 (ICON-CH1) alle Frames mit `tMs > forecastCutoff` überspringen.
- Phase 2 (ICON-CH2) komplett weglassen — die gesamte `r2`/`ref2`-Schleife entfernen, da sie nur >33 h beitrug.

**`src/components/maps/radar-map.tsx`**
- Timeline-Ticks anpassen, damit die Skala zur neuen Spanne passt:
  - `TIMELINE_TICKS_DESKTOP`: `[-2, -1, 0, 3, 6, 12, 24, 32]`
  - `TIMELINE_TICKS_MOBILE`: `[-1, 0, 6, 16, 32]`
- ICON-CH1/CH2-Übergangsmarker im Slider entfernen (die violette `ch1Pct`-Markierung und der zweite Farbabschnitt), da es nur noch eine Vorhersagequelle gibt. Vergangenheit/Zukunft (vor/nach „Jetzt") bleibt visuell unterschieden.
- Legendentext / Hinweis auf ICON-CH2 entfernen, falls vorhanden (kurz prüfen, sonst weglassen).

### 2. Symbolprognose: Regentropfen schlanker und weniger markant

**`src/components/weather-icons/index.tsx`** — `Drop`-Komponente (Z. 145–157):
- Pfad schlanker zeichnen: Breite von ±4.2 auf ±3.0 reduzieren, Höhe leicht kürzen (Tip −5, Boden 6.5).
- `strokeWidth` von `0.9` auf `0.5` reduzieren, damit der dunkle Rand zurücktritt.
- Damit wirken die Tropfen in `IconRain`, `IconDrizzle` und `IconThunderstorm` automatisch dezenter — die bestehenden `size`-Werte bleiben, das Erscheinungsbild wird einfach feiner.

Keine Änderungen an Geschäftslogik, Datenquellen, Ingest-Skripten oder am Region-Layer.
