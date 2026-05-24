# Pills im DayStrip zurücksetzen

In `src/components/weather-widget.tsx` die kürzlich eingeführten blauen Hintergründe im **DayStrip** (7-Tage-Übersichtspillen) rückgängig machen:

- Default-Tageskarte: `bg-[var(--accent-soft)]` → zurück auf `bg-zinc-50`.
- Hover: `hover:bg-[color-mix(in_oklab,var(--accent)_14%,white)]` → zurück auf den ursprünglichen Hover (`hover:bg-zinc-100` o.ä., wie vor der Änderung).
- Aktive Tageskarte: `bg-[color-mix(in_oklab,var(--accent)_22%,white)]` mit `text-accent-foreground` → zurück auf den Ursprungszustand (`bg-[var(--accent-soft)]`, normale Textfarbe, Accent-Linie oben bleibt).

## Nicht angefasst

- **Detail-Panel** behält die blauen Hintergründe (Section, Header-/Footer-Leisten, aktiver Slot).
- Ortung-Fallback (Nominatim) und „Kein Default-Ort"-Verhalten bleiben unverändert.
- Karten, Routen, Icons unverändert.
