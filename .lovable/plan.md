## Ziel

In der Lokalprognose (`src/components/weather-widget.tsx`) die Wind-Darstellung neu gewichten und Schriftstärken in Tageskacheln und Detail-Panel klarer hierarchisieren — primäre Werte deutlich fetter, sekundäre dünner.

## 1) Windpfeil grösser

`WindArrow` (Zeile 1187):
- Aktuell `↑` in Default-Grösse, `text-zinc-500`.
- Neu: Grösse explizit setzen — `text-base` in Tageskacheln, `text-lg` im Detail-Panel. Etwas kräftigere Farbe (`text-zinc-700`) und `font-bold` für sichtbare Strichstärke.
- Optional: `inline-flex w-4` als Slot, damit Rotation nichts verschiebt.

Umsetzung: `size`-Prop an `WindArrow` ergänzen (`"sm" | "md" | "lg"`, default `md`), Aufrufer setzen entsprechend.

## 2) Wind/Böen-Schriftgewicht umdrehen

Aktuell ist Mittelwind fett und Böen dünner — gewünscht: **Böenspitzen dick, Mittelwind dünn**.

Tageskachel (Zeile 585–592):
```
mittel: font-medium text-zinc-700 tabular-nums
böen:   font-bold   text-zinc-900 tabular-nums
```

Detail-Slot (Zeile 906–911):
```
mittel: font-medium text-zinc-700
böen:   font-bold   text-zinc-900
```

Separator `/` bleibt, Einheit `km/h` bleibt `font-medium text-zinc-700`.

## 3) Allgemein Schriftstärken in Kacheln deutlicher

DayStrip-Tageskachel (Zeile 533–593):
- Wochentag-Titel: bleibt `font-bold`, aber Display-Schrift bleibt.
- Datum darunter: `font-medium` → `font-semibold text-zinc-800`.
- Min-Temp: bleibt `font-medium text-zinc-600` (dünner, klein).
- Max-Temp: bleibt `font-bold` (Hauptwert).
- Niederschlag-Zeile (mm / %): `font-medium` → `font-semibold text-zinc-800`.
- `Wind`-Icon: leicht grösser (`w-4 h-4`) und `text-zinc-700`.

## 4) Allgemein Schriftstärken im Detail-Panel deutlicher

- Header „Heute/Morgen/Wochentag" (Zeile 725): bleibt `font-bold`.
- Takt-Legende oben (Zeile 732): `font-bold uppercase` bleibt, Farbe von `text-zinc-500` → `text-zinc-700` für besseren Kontrast.
- Y-Achsen-Beschriftungen (mm/3h, min/h, cm/3h): `font-semibold` → `font-bold text-zinc-900`.
- Slot-Uhrzeit (Zeile 873): `font-bold` bleibt, Farbe Nicht-Current von `text-zinc-800` → `text-zinc-900`.
- Slot-Temperatur (Zeile 898): bleibt `font-bold text-zinc-900`.
- Niederschlags-Werte unter den Balken (Zeile 974, 981): mm bleibt `font-bold`, %-Zeile `font-medium text-zinc-600` → `font-semibold text-zinc-700`.
- Sonne (min) und Schnee (cm) Werte: bleiben `font-bold`, Einheit-Labels `font-medium text-zinc-600` → `font-semibold text-zinc-700`.
- Footer-Legende (Zeile 1137): `font-semibold` → `font-bold`.

## 5) Keine Farb-/Tokenänderungen

Nur Tailwind-Klassen für `font-*`-Stärken und vereinzelt `text-zinc-*`-Tönungen, keine Anpassung der semantischen Design-Tokens in `src/styles.css`.

## Betroffene Datei

- `src/components/weather-widget.tsx` — `WindArrow`, `DayStrip`, `DetailPanel` (Header, Y-Achsen, Slot, Niederschlag-/Sonne-/Schnee-Beschriftungen, Footer).

## Out of scope

- `radar-map`, `wind-map`, andere Routen.
- Datenlogik, Aggregation, Modellquellen.
