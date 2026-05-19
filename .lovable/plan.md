## Änderungen

### 1. `src/lib/weather.ts` — Modell-Strategie vereinfachen

- `fetchForecast` ruft nur noch `meteoswiss_icon_seamless` ab (keine ECMWF-Anfrage, kein `mergeForecasts`-Aufruf). Funktion `mergeForecasts` + Konstante `ECMWF_FROM_DAY` entfernen.
- Damit verschwindet auch der ECMWF-Pfad, bei dem `windgusts_10m` teils fehlt → Böen kommen wieder konsistent aus ICON. (Erfüllt sowohl Pessimismus-Korrektur als auch Böen-Fix in einem Schritt.)
- `TOTAL_DAYS` bleibt `7` als API-Obergrenze.
- Zusätzlich neue stündliche Variable `sunshine_duration` in `HOURLY_VARS` aufnehmen und Typ `HourlyData` um `sunshine_duration: number[]` erweitern; in `sanitizeForecast` mitfixen. Wert kommt von Open-Meteo in Sekunden pro Stunde (0–3600).

### 2. `src/components/weather-widget.tsx` — Tagesanzahl bis Samstag, dann Auto-Roll

- Neue Hilfsfunktion `computeVisibleDayCount(today: Date)`:
  - Tage bis einschliesslich kommendem Samstag = `(6 - today.getDay() + 7) % 7 + 1`, also Mo=6, Di=5, …, Sa=1, **So=7** (Auto-Roll: am Sonntag werden direkt 7 Tage gezeigt → Mo–So der neuen Woche).
- `days`-Memo nutzt `slice(0, visibleCount)` statt `slice(0, 7)`. Gilt analog für `DayStrip` (Karten **und** Sonnen-Bar-Spalten) und `SkeletonWidget` (count statt fix 7).
- Grid-Layout: `@[900px]:grid-cols-7` bleibt — der Flex-Container füllt automatisch nur die verfügbaren Tage; bei `visibleCount < 7` zeigen wir trotzdem alle vorhandenen Spalten gleich breit, indem wir `grid-cols-{n}` dynamisch per `style={{ gridTemplateColumns: 'repeat(${visibleCount}, minmax(0,1fr))' }}` setzen.

### 3. `src/components/weather-widget.tsx` — Sonnenschein-Säulen pro 3h-Slot

- Im erweiterten Modus die bisherige Tages-Sonnen-Leiste unter `DayStrip` **entfernen**.
- Stattdessen im `DetailPanel` (nur wenn `extended === true`) **eine zweite Bar-Reihe** analog zur Niederschlagsreihe einfügen, **unterhalb** der Precipitation-Bars:
  - Summiere `sunshine_duration` der 3 Stunden im Slot → Sonnenminuten (0–180), umgerechnet `min/h = sum / 3 / 60`.
  - Höhe = `min(minPerHour / 60, 1) * 100%`, Farbe `var(--wx-sun)`, abgerundete Oberkante.
  - Eigene Y-Achse links: 0 / 30 / 60 mit Label `min/h Sonne` (zweite Y-Achsen-Spalte unter der `mm/3h`-Spalte, gleiche Breite `w-10`).
  - Gridlines bei 0 / 30 / 60.
  - Wert-Label unter der Säule: `{minPerHour} min`.
- `extended === true` muss die Detail-Höhe entsprechend wachsen lassen; bei `extended === false` wird die Sonnen-Reihe nicht gerendert.
- `Footer` zeigt Sonnenauf-/-untergang des selektierten Tages weiterhin.

### 4. Detail-Panel: Böen-Anzeige robust

- Falls trotz ICON-Only-Modus `windgusts_10m[idx] === 0` bei `windspeed_10m[idx] > 0` (defensiv für Cache-/Edge-Cases), in der Anzeige `gust = max(gust, Math.round(windspeed * 1.4))` als Anzeige-Fallback verwenden — nur Darstellung, Daten unverändert. Klein gehalten, damit keine echten Null-Wind-Stunden falsche Böen kriegen.

## Nicht enthalten

- Kein UI-Redesign, keine Farbänderungen, keine neue Library.
- Kein zusätzliches Modell — bewusst nur MeteoSchweiz ICON (Wunsch des Users).
- Sprachsteuerung, Themes, Tests bleiben unverändert.
