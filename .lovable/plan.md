## Änderungen in `src/components/weather-widget.tsx`

### 1. Header aufräumen
- Titel **„Lokalprognose Amriswil"** entfernen (Standort ist fix Amriswil, redundant).
- Falls eine Unterzeile/Subtitle existiert: nur Datum/Aktualisierung lassen.

### 2. „Erweiterte Anzeige" → „Sonnenschein"
- Toggle-Label im Detail-Panel umbenennen: `Erweiterte Anzeige` → `Sonnenschein`.
- Interne Variable `extended` bleibt bestehen (nur Label-Änderung), damit keine Logik bricht.

### 3. Footer
- **Sonnenauf-/Sonnenuntergang unten rechts entfernen** (`Footer`-Bereich des Detail-Panels).
- An gleicher Stelle (oder zentriert unten) eine **Legende** einsetzen:
  ```
  Grafik & Daten © oberthurgauerwetter.ch
  ```
  Dezent, `text-xs text-muted-foreground`, ggf. mit Link auf `https://oberthurgauerwetter.ch`.

### 4. Tagesübersicht: 7-Tage-Prognose, 5 sichtbar, Auto-Roll für 2

Bisherige `computeVisibleDayCount`-Logik (bis Samstag) **ersetzen**:

- `days`-Memo nutzt wieder volle **7 Tage**.
- `DayStrip` zeigt nur **5 Tage gleichzeitig** mit Auto-Roll-Verhalten:
  - Auf Desktop (≥ 900px): Grid mit 5 sichtbaren Spalten, horizontal scrollbarer Container (`overflow-x-auto snap-x snap-mandatory`), jede Karte `snap-start` und `min-w-[20%]` (5 Spalten Breite).
  - Auto-Roll: `useEffect` mit `setInterval` (z.B. 6 s), das sanft um eine Spaltenbreite weiterscrollt; bei Erreichen von Tag 7 zurück auf Tag 1.
  - User-Interaktion (manuelles Scrollen, Hover oder Klick auf eine Tageskarte) pausiert das Interval; nach 15 s Inaktivität wieder aktiv.
- `SkeletonWidget`: 5 Platzhalter-Karten (statt 7).
- Sonnen-Bar-Reihe im Detail-Panel ist davon nicht betroffen — sie hängt am ausgewählten Tag, nicht an der Strip-Breite.

## Nicht enthalten

- Keine Änderungen an `src/lib/weather.ts` (weiterhin 7 Tage MeteoSchweiz ICON, `sunshine_duration` bleibt).
- Keine Farb-, Theme- oder Layout-Änderungen ausserhalb der genannten Stellen.
- Keine neuen Libraries (Auto-Roll via nativem `scrollTo({ behavior: 'smooth' })`).
