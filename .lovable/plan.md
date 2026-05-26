## Slider-Layout der Radar-Karte auf "Wetterkarte Region" übertragen

**Datei:** `src/components/region-map.tsx` (Block ab Zeile ~672 "Moderner 3-Stunden-Zeitstrahl")

### Änderungen

Den bestehenden Zeitstrahl-Block visuell an das neue Radar-Panel angleichen, ohne die Region-Logik (stündlich/täglich, `stepOffset`, `MAX_STEPS`) zu verändern.

1. **Panel-Stil**
   - Container: `rounded-2xl border border-border bg-card p-3` → `rounded-xl border border-neutral-200 bg-white p-2 sm:p-3 shadow-md`
   - Kompaktere Innenabstände, keine grosse Kopfzeile mehr — der Wochentag/das Datum wandert in eine schmale Zeile unter den Track (analog Radar).
   - Aktueller Stundenchip (`BRAND`-Hintergrund) entfällt; stattdessen Time-Bubble direkt am Thumb (existiert bereits, wird kompakter `px-2 py-0.5 text-[10px]`).

2. **Slider deutlich schlanker**
   - Stundenlabels (HH) **über** dem Track, `text-[9px] text-neutral-500`, jede Stunde (mobile: jede 3.).
   - Track-Höhe auf 3 px (`bg-neutral-200`), gefüllter Bereich von 0 bis Thumb in `BRAND`-Blau, dünner senkrechter Handle (`h-4 w-0.5 bg-neutral-900`).
   - Verwendet weiterhin die shadcn `<Slider>`-Komponente, aber per CSS (Klasse `region-slider` ist schon da, oder inline-Override) auf 3 px Track und kleineren Thumb gestylt.
   - Tages-Label (`Montag, 25.05.2026`) unter dem Track, `text-[10px] text-neutral-600`. Vertikale Trennlinien bei 00:00, falls der Bereich mehrere Tage umfasst.
   - "Jetzt"-Marker (kleiner Kreis bei `step = 0`).

3. **Sekundär-Toolbar im gleichen Stil**
   - Die bisherigen `DayTabs` darüber bleiben erhalten (eigene Komponente, unverändert in Funktion).
   - Innerhalb des Panels darunter optional eine kompakte Zeile mit "Jetzt"-Button (`stepOffset → 0`), Stil identisch zu Radar (weiss, Border, aktiv = BRAND-Blau).
   - Im "daily"-Modus bleibt der Slider deaktiviert/abgedimmt wie bisher.

4. **Footer**
   - "Datenstand: …" Zeile innerhalb des Panels in `text-[10px] text-neutral-500` analog Radar-Footer, statt separater zentrierter Zeile darunter.

### Nicht geändert
- `DayTabs`, Karten-Logik, Wetter-Datenmodell, `stepOffset`/`MAX_STEPS`, `HOUR_LABELS`.
- Kein Play/Pause (Region-Karte hat keine Animation).
- Kein Eingriff in `radar-map.tsx`.
