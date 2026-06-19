## Ziel

Lokalprognose-Kacheln im Stil des Referenz-Screenshots vereinheitlichen, eine Tagesübersicht zwischen Kachel-Strip und Detail-Panel einfügen und das automatische Scrollen im Panel abschalten.

## 1. DayStrip – neue Kachel-Struktur (`src/components/weather-widget.tsx`, `DayStrip`)

Layout pro Kachel (von oben nach unten):

```text
Wochentag (fett)            ← Freitag / Samstag …
Datum (klein)               ← 19.06.

      [ Symbol-Icon ]       ← MCH-Pictogramm, zentriert

   15° | 32°                ← min | max, Trenner "|"
─────────────────────────
1 mm        32 %            ← Tagessumme links, Wahrscheinlichkeit rechts
[▁▂▃▅▂▁ Mini-Balken ]      ← wann am Tag Regen fällt
```

Änderungen im Detail:
- Temperatur-Zeile: `min° | max°` mit vertikalem Strich-Trenner, beide gleich gewichtet (nicht mehr min „leise", max „laut").
- Regen-Zeile: links `x.x mm` (Tagessumme), rechts `xx %` (Tageshöchstwahrscheinlichkeit). `<5 %` statt „0 %", wenn 1–4 %.
- **Neu**: Mini-Regenbalken-Sparkline (Höhe ≈ 14 px) unter der Regen-Zeile. Quelle = `hourly.precipitation` für die 24 h des jeweiligen Tages, in 8 × 3-h-Buckets aggregiert; Balkenhöhe proportional zur mm-Summe (cap bei 5 mm), Farbe `var(--wx-rain)`, Opazität moduliert über `precipitation_probability`. Bei 0 mm: leere Spur (dünne Bodenlinie).
- Wind-Block am Kachelfuß entfällt (wandert in die neue Übersicht-Zeile, s. u.).
- Wegfall: `Thermometer`- und `CloudRain`-Inline-Icons in der Temperatur-/Regen-Zeile (Screenshot-Stil ist iconlos).

## 2. Neue Tagesübersicht zwischen Strip und Panel

Eigene Sub-Komponente `DaySummaryBar`, gerendert zwischen `<DayStrip />` und `<DetailPanel />`. Zeigt die Eckwerte des aktuell `selectedDayIdx` ausgewählten Tages, kompakt in einer Zeile:

```text
Freitag 19.06.26   💧 1 mm / 32 %   ☀ 13 h   🌬 6 | 28 km/h   ☀↑ 05:24   ☀↓ 21:23
```

Felder & Quellen (alle aus `forecast.daily`):
- Wochentag + Datum (gleiche Formatierung wie im Screenshot-Footer).
- Niederschlag: `precipitation_sum` + `precipitation_probability_max`.
- Sonnenscheindauer: `sunshine_duration / 3600` → ganze Stunden.
- Wind: `windspeed_10m_max` (mittel) `|` `windgusts_10m_max` (Böen) km/h, plus Pfeil aus `winddirection_10m_dominant`.
- Sonnenauf-/-untergang: `sunrise[i]` / `sunset[i]` (`formatTimeHHMM`).

Styling: gleiche Palette wie Detail-Panel-Header (`bg-[color-mix(in_oklab,var(--accent)_18%,white)]`), 1 Zeile, `flex flex-wrap gap-x-4`, `text-sm`. Mobile: bleibt 1 Zeile so lange möglich, sonst sauberer Wrap.

Damit verschwindet die heutige Footer-Zeile mit Datum + 💧 / ☀ / 🌬 / ☀↑ ☀↓ aus dem Bildschirmrand – diese Information sitzt jetzt prominent über dem Panel.

## 3. Detail-Panel-Verhalten

Aktuell scrollt `useEffect` im `DetailPanel` bei Wechsel von `selectedDayIdx` automatisch zur ersten Stunde des Tages (`scroller.scrollTo({ left: …, behavior: "smooth" })`). Das soll weg.

Änderung:
- Initial-Scroll zur aktuellen Stunde beim ersten Mount: **bleibt** (Komfort beim Öffnen).
- Auto-Scroll bei nachträglichem Wechsel von `selectedDayIdx` durch Klick auf eine Kachel: **entfernen**. Der Nutzer scrollt selbst horizontal; der Tag-Strip markiert nur noch den ausgewählten Tag visuell.
- Der bestehende Reverse-Mechanismus (Scrollen → `onVisibleDayChange`) bleibt unverändert.

Technisch: ersten `useEffect`-Block (`Scroll to first slot of the selected day`) auf „nur beim allerersten Render mit forecast.data, dann auf `Date.now()`-Stunde scrollen" reduzieren, statt bei jedem `selectedDayIdx`-Change.

## 4. Was unberührt bleibt

- Detail-Panel selbst (Stunden-Slots, Regen-/Sonne-/Schnee-Balken), Header, Footer, Datenquellen, Server-Funktionen.
- Keine neuen Abhängigkeiten, keine Schema-Änderungen.
- `embedMinimal`, `extended`, `snow` Toggles bleiben funktional.

## Technische Notizen

- Die Mini-Regenspur in den Kacheln bekommt eine eigene kleine Sub-Komponente `DayRainSparkline({ daily, hourly, dayIso })`, die `hourly.time` nach Datum filtert und in 3-h-Buckets summiert.
- `DaySummaryBar` ist eine reine Präsentations-Komponente; bekommt `forecast` + `selectedDayIdx` als Props.
- Verifikation: nach den Änderungen `browser--view_preview` auf `/karten/lokal` (Desktop + Mobile 390 px), sichtprüfen.
