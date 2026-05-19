## Ziel

Vier Verbesserungen am Wetter-Widget:
1. Wettersymbole grösser und visuell deutlicher
2. Schrift in der Detailansicht und im Tagesstreifen besser lesbar
3. Wettermodell von `icon_seamless` auf die MeteoSchweiz-Modelle **ICON-CH1-EPS** und **ICON-CH2-EPS** umstellen
4. Horizontales Scrollen der Stundenansicht **flüssig über Tagesgrenzen hinweg** (z. B. Fr 21:00 → Sa 00:00 → … nahtlos)

---

## 1. Symbole grösser & deutlicher

`src/components/weather-widget.tsx`

- **DayStrip** (Tageskarten): `<WeatherIcon size={52} />` → `size={72}`, vertikales Padding der Icon-Zelle erhöhen.
- **DetailPanel** (Stundenraster): `<WeatherIcon size={32} />` → `size={56}`, Mindestbreite pro Stunden-Spalte von ~`min-w-[820px]` / 8 Spalten → breitere Spalten (`min-w-[110px]` pro Slot, scrollbar).
- Hintergrund hinter Icons leicht abgesetzt (subtiler `bg-zinc-50` Kreis / Padding), damit gefüllte Farben sich vom Karten­hintergrund abheben.

## 2. Schrift deutlicher

`src/components/weather-widget.tsx`

- Stunden-Label `text-[11px]` → `text-sm font-semibold`, Farbe von `text-zinc-400` auf `text-zinc-600` (Kontrast).
- Temperatur in der Stundenspalte: `text-lg` → `text-xl font-semibold`, immer `text-zinc-900`.
- Niederschlag/Wahrscheinlichkeit `text-[10px]` → `text-xs`, Farbe `text-zinc-500` → `text-zinc-700` für Werte, Label bleibt zinc-500.
- Wind-Zeile in DayStrip / DetailPanel von `text-[10px]` → `text-xs`.
- Header der Detailansicht: `text-[11px]` → `text-sm`.

Keine Layout-Brüche: Spalten werden minimal breiter, Gesamt-Scroll-Container bleibt.

## 3. Modellwechsel auf ICON-CH1-EPS / ICON-CH2-EPS

`src/lib/weather.ts` (Funktion `fetchForecast`)

Open-Meteo unterstützt die MeteoSchweiz-Modelle direkt als Modell-Identifier:
- `icon_ch1` (ICON-CH1-EPS, ~1 km, Kurzfrist bis ~33 h)
- `icon_ch2` (ICON-CH2-EPS, ~2 km, bis ~120 h)

Änderung:
```ts
url.searchParams.set("models", "icon_ch1,icon_ch2");
```
Open-Meteo liefert dabei automatisch die feinere Auflösung (CH1) für die ersten Stunden und CH2 für die längere Frist, wenn beide Modelle angegeben sind. Keine weitere Code-Anpassung nötig — Response-Struktur bleibt identisch.

Falls die Koordinaten ausserhalb der Schweiz/des CH-Modellgebiets liegen, würde Open-Meteo leere Arrays zurückgeben. Da das Widget ausschliesslich für CH gedacht ist (Geocoding ist auf `countryCode=CH` gefiltert), ist das unkritisch. Optional: Fallback auf `icon_seamless` bei leerer Response — erwähne es, baue es aber nur ein, wenn gewünscht.

## 4. Nahtloses horizontales Scrollen über Tage hinweg

Aktuell zeigt `DetailPanel` nur die Stunden **eines** Tages, abhängig von `selectedDayIdx`. Das bricht beim Übergang Fr 21:00 → Sa 00:00.

**Neue Logik:**

- `hourlyForDay` (heute pro Tag gefiltert) wird ersetzt durch eine **durchgehende Stundenliste** über alle 6 Tage, im 3 h-Takt.
- Beim Klick auf einen Tag in `DayStrip` wird in den Stunden-Container zum ersten passenden Slot dieses Tages **geschrollt** (`scrollIntoView({ behavior: "smooth", inline: "start" })`), statt die Liste auszutauschen.
- Beim manuellen Scrollen läuft der Nutzer ohne Sprung über Mitternacht hinaus.
- Optische Tagestrennung: pro Slot, der den Tageswechsel markiert (`00:00`), eine deutlichere linke Border + kleines Datums-Label (z. B. „Sa 24.“) oberhalb der Uhrzeit, damit der Übergang erkennbar bleibt.
- „Jetzt"-Markierung (`isCurrent`) bleibt erhalten und basiert weiter auf `now`.

**Technisch:**

- Neuer Memo `allHourly` = Liste aller `hourly`-Indizes im 3 h-Takt, beginnend beim aktuellen 3 h-Block.
- `DetailPanel` rendert `allHourly` statt `hourlyIndices`.
- `refs` Map (slotKey = ISO-Zeit) und ein `useEffect` auf `selectedDayIdx`, der zum ersten Slot des Tages scrollt.
- `selectedDay`-Header wird zur dynamischen Anzeige des **gerade sichtbaren** Tages (IntersectionObserver auf Slots → setzt internen Anzeige-Tag). `selectedDayIdx` bleibt für die DayStrip-Hervorhebung.

Scroll-Container: `scroll-smooth snap-x snap-mandatory`, jeder Slot `snap-start`, damit das Wischen sauber einrastet, aber kontinuierlich über Mitternacht hinaus möglich ist.

---

## Geänderte Dateien

- `src/lib/weather.ts` — Modell-Parameter auf `icon_ch1,icon_ch2`.
- `src/components/weather-widget.tsx` — grössere Icons, lesbarere Schrift, neue durchgehende Stundenliste mit Smooth-Scroll und Auto-Scroll bei Tagesauswahl.

Keine Änderungen an `weather-icons/index.tsx` (Farbe/Stil bleibt wie zuletzt approved), kein Backend, keine API-Keys.

---

## Offene Frage

Soll bei leerem Ergebnis ausserhalb des CH-Modellgebiets automatisch auf `icon_seamless` zurückgefallen werden, oder reicht für jetzt der reine CH-Fokus?
