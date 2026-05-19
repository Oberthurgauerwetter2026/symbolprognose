## Schriftstärke im gesamten Widget deutlich verstärken (+2 Stufen)

Ausschliesslich in `src/components/weather-widget.tsx`. Keine Änderungen an Daten, Layout, Farben (ausser Textfarben werden dunkler für mehr Kontrast).

### Globale Regel

- `font-medium` → `font-semibold`
- `font-semibold` → `font-bold`
- Reine `text-zinc-500`-Labels → `text-zinc-700 font-medium`
- Reine `text-zinc-400` (Sublabels Werte) → `text-zinc-600`
- `text-zinc-600` für kleine Werte → `text-zinc-800 font-semibold`
- Body-Default des Widget-Wrappers bekommt `font-medium` als Basis (`text-zinc-900 antialiased font-medium`).

### Betroffene Stellen konkret

**Header**
- Suchfeld: `placeholder` bleibt, Input-Text `font-medium`.
- Ortungs-Button: `font-medium` → `font-semibold`.
- Switch-Labels „Sonnenschein" / „Schnee": `font-medium` → `font-semibold`, Farbe `text-zinc-700` → `text-zinc-900`.

**DayStrip (5-Tage-Karten)**
- Tagesname (Heute / Morgen / Wochentag): `font-semibold` → `font-bold`.
- Datums-Zeile darunter: `text-zinc-500` → `text-zinc-700 font-medium`.
- Max-Temperatur: `font-semibold` → `font-bold`.
- Min-Temperatur: `font-medium` → `font-semibold`, Farbe `text-zinc-500` → `text-zinc-700`.
- mm / % Zeile: `text-zinc-500` → `text-zinc-700 font-medium`, tabular bleibt.
- Wind-Block: Labels `text-zinc-500` → `text-zinc-700 font-medium`; Wert `font-medium` → `font-semibold`; Gust-Trenner `text-zinc-400` → `text-zinc-600`.
- Sonnenauf-/untergang (extended): `text-zinc-500` → `text-zinc-700 font-medium`.

**Detail-Panel Header**
- Tagesname: `font-semibold` → `font-bold`.
- Sub-Headline „3h · Temperatur °C · Wind / Böenspitzen km/h": `text-zinc-500` → `text-zinc-700 font-medium`.

**Y-Achsen-Labels** (Regen / Sonne / Schnee)
- Skalenzahlen: `text-zinc-500` → `text-zinc-700 font-semibold`.
- Achsentitel („Regen mm/3h" usw.): `text-zinc-500` → `text-zinc-800 font-semibold`.

**Stundenslots**
- Stundenanzeige (z.B. 09:00): `font-semibold` → `font-bold`, Farbe `text-zinc-600` → `text-zinc-800`.
- Temperatur: `font-semibold` → `font-bold`.
- Wind-Wert: `font-semibold` → `font-bold`; Gust `text-zinc-500` → `text-zinc-700 font-medium`; Richtungs-Label `text-zinc-500` → `text-zinc-700 font-medium`.

**Chart-Werte unter den Balken** (Regen / Sonne / Schnee)
- Hauptwert: `font-medium` → `font-bold`, Farbe `text-zinc-600` → `text-zinc-900`.
- Sublabel (% bzw. „min" / „cm"): `text-zinc-400` → `text-zinc-600 font-medium`.

**Legendenzeile am Fuss des Panels**
- `text-zinc-500` → `text-zinc-700 font-semibold`; Schriftgrösse `text-[10px]` → `text-[11px]`.

**Footer**
- Quellen- und Copyright-Zeile: `text-zinc-500` → `text-zinc-700 font-medium`.

### Nicht im Plan

- Keine Änderungen an Schriftgrössen (ausser Legendenzeile +1px), Abständen, Farben oder Layout.
- Keine neue Font-Familie.
