## Ziel

Layout an SRF Meteo angelehnt modernisieren: ruhige Typografie ohne durchgehende Grossbuchstaben, klare Akzentfarbe **#2561a1** (statt aktuellem Rot), echter Switch-Schalter für "Erweiterte Anzeige", Niederschlagsbalken in der Detailansicht, und Aufräumen der Detail-Header.

## Änderungen

### 1. Farbsystem (`src/styles.css`)
- `--accent` und `--ring` auf `#2561a1` umstellen
- Neue Tokens: `--accent-soft` (helle Blau-Tönung für Hintergründe), `--accent-strong` (dunkler für Hover)
- Niederschlagsbalken-Farbe: `--wx-rain` bleibt, wird für Balken verwendet

### 2. Typografie & Lesbarkeit (`weather-widget.tsx`)
- Alle `uppercase`-Klassen entfernen bei: Header-Titel, Tag-Labels ("Heute/Morgen/Wochentag"), Detailansicht-Überschrift, Footer, Switch-Label
- `tracking-widest`/`tracking-wider` reduzieren auf normales `tracking-tight`/keines
- Schriftgrössen leicht hochziehen: Tag-Label `text-base font-semibold`, Detail-Header `text-base`
- Wochentag-Anzeige in normaler Schreibweise ("Heute", "Samstag, 23. Mai")

### 3. Erweiterte Anzeige als echter Switch
- Ersetze die zwei Ein/Aus-Buttons durch shadcn `<Switch>` (bereits vorhanden in `ui/switch.tsx`)
- Label rechts neben Switch: "Erweiterte Anzeige" in normaler Schrift
- Visuell dezenter, kein Box-Container mehr nötig

### 4. Niederschlagsbalken in Detailansicht
- Pro 3h-Slot: kleine vertikale Balkengrafik direkt unter/neben der mm-Zahl
- Höhe proportional zu `precipitation[idx]`, skaliert auf max. Wert des sichtbaren Tages (oder fester Skala 0–10 mm = 100%)
- Farbe `var(--wx-rain)`, Hintergrundtrack hellgrau
- Opacity gekoppelt an `precipitation_probability` (z.B. 30–100% Opacity)
- Bei 0 mm: leerer Track sichtbar

### 5. Detailansicht-Header aufräumen
- Header-Zeile: nur "Detailansicht" + Info-Suffix rechts ("3-Stunden-Takt")
- Wochentag/Datum aus dem Header entfernen (steht ja im DayStrip oberhalb)
- Innerhalb der Slots: Tagestrenner-Label (Wochentag+Datum beim ersten Slot eines neuen Tages) **bleibt**, da es beim Scrollen Orientierung gibt — aber in normaler Schreibweise

### 6. DayStrip-Politur
- Aktiver Tag: Akzentbalken oben in #2561a1, dezenterer Hintergrund-Tint (`--accent-soft`)
- Min/Max-Temperatur klarer hierarchisiert (Max gross/dunkel, Min mittelgrau)
- Labels in Mixed-Case

## Technische Details

- Farben ausschliesslich über CSS-Variablen in `src/styles.css`, keine Hex-Werte in Komponenten
- Switch-Import: `import { Switch } from "@/components/ui/switch"` + Label daneben
- Balken: einfaches `<div>` mit `height: ${pct}%` in einem Track-Container (`h-10 w-1.5`), kein Chart-Lib nötig
- Skala für Balken: `Math.min(precipitation / 5, 1) * 100` (5 mm = volle Höhe, darüber Cap) — alternativ pro Tag normalisiert, entscheide ich im Build für die einfachere Variante
- Keine Änderung an `weather.ts` oder Datenflüssen

## Nicht enthalten

- Keine Änderung an Icons, Modellblend-Logik, Geosuche, Routing
- Keine Mobile-spezifischen Layout-Umbauten über die bestehenden Breakpoints hinaus
