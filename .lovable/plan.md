## Ursache

Aktuell baut `playStepIndices` (radar-map.tsx, Z. 1847–1880) die Schrittliste, indem es **vorhandene Frames in Buckets sortiert** und je Bucket den ersten Frame nimmt. Wenn die Forecast-Schiene für 0–24 h faktisch nur stündliche Frames liefert (z. B. weil ICON-CH1 `minutely_15` für einen Lauf nicht da ist und der Fallback nur `hourly` füllt), bleibt der 15-min-Takt im Filmstrip aus — man sieht trotzdem nur Stunden-Schritte. Genau das tritt aktuell auf.

## Fix

Cadence **zielzeitgesteuert** statt buckettierend bauen. Es werden Zielzeiten in den vom Nutzer gewünschten Schritten erzeugt und für jede Zielzeit der nächstgelegene reale Frame ausgewählt — mit einer Toleranz, die kleiner ist als der jeweilige Schritt, damit kein Frame doppelt verwendet wird.

### Änderungen in `src/components/maps/radar-map.tsx`

**`playStepIndices` (Z. 1847–1880)** neu aufbauen:

1. **Zielzeit-Raster** aus `nowMs = Date.now()` ableiten:
   - Messung: alle 5 min von `firstFrameMs` (auf 5-min abgerundet) bis ≤ `nowMs`.
   - Prognose A: alle 15 min ab dem nächsten 15-min-Slot nach `nowMs` bis `nowMs + 24 h`.
   - Prognose B: alle 60 min ab `nowMs + 24 h + 1 h` (auf volle Stunde) bis `lastFrameMs`.
2. **Frame-Zuordnung pro Zielzeit:** binäre Suche im sortierten `times`-Array (`Date.parse(f.t)`); nimm den näheren Nachbarn. Akzeptiere nur, wenn `|frameMs − targetMs| ≤ 0.5 × stepMs` (also ≤ 2.5 min / 7.5 min / 30 min). Sonst Zielzeit überspringen.
3. **Duplikate vermeiden:** wenn der gefundene Frame-Index identisch zum zuletzt aufgenommenen ist, überspringen. So bleibt der Filmstrip ruhig, falls eine Phase nur stündliche Daten liefert (dann fallen die 15-min-Slots ohne passenden Frame raus statt denselben Frame 4× zu pinnen).
4. **Kein Verschluck-Skip am Übergang nötig:** durch das Raster liegen Mess→Prognose-Übergänge automatisch ≥ 5 min auseinander; die bisherige `0.4 × bucketSize`-Skip-Regel entfällt.

**Play-Loop (Z. 1904–1980)** bleibt unverändert: er nutzt weiterhin die reale Zeit-Delta zwischen aufeinanderfolgenden Step-Indizes (`REF_GAP_MS = 15 min`), sodass 5-min-Schritte schneller, 60-min-Schritte langsamer durchlaufen — Tempo bleibt zeit-proportional.

**`stripFrames` / Filmstrip-Render (Z. 1986–1990, 2325–2336)** bleiben unverändert; sie lesen weiter aus `playStepIndices`.

## Verifikation

- `bunx tsgo --noEmit`
- Im Preview `/karten/radar`: Filmstrip zeigt Messung in 5-min-Schritten, Prognose 0–24 h durchgehend 15-min-Schritte, danach 60-min-Schritte; Play läuft gleichmässig durch alle drei Phasen ohne Hänger.
- Console-Log einmalig: Anzahl Steps je Phase (`measurement / forecast15 / forecast60`) zur Kontrolle, ob Toleranz-Filter Lücken erzeugt.
