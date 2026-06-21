## Ziel

Das Snippet **"Lokalprognose Amriswil"** so anpassen, dass das eingebettete Panel in WordPress nicht über die Unterkante des TWINT-Labels in der rechten Spalte hinausragt (siehe Screenshot).

## Analyse

Heute liefert `buildAmriswilSnippet` (in `src/routes/embed-info.tsx`) ein iframe mit `height:640px`. Der Inhalt selbst (Route `/api/public/embed/region-lokal-static`) zeigt:
- Aktuelles Wetter (Karte)
- "Nächste Stunden" Tabelle (alle gelieferten Stundenzeilen)
- Tagesprognose

Bei `640px` läuft die Stunden-Tabelle bis ca. 02:00 Uhr — deutlich tiefer als die TWINT-Spalte, die auf ungefähr Höhe des TWINT-Buttons endet (~520–540 px).

## Änderungen

### 1. `src/routes/api/public/embed/region-lokal-static.ts`
- Stunden-Tabelle visuell auf ein Panel limitieren, damit sie nicht endlos wächst:
  - Max. **6 Stundenzeilen** rendern (bzw. per Inline-CSS `max-height` + `overflow:hidden` zuschneiden).
  - Tagesprognose-Block bleibt erhalten, falls Platz; sonst per `@media`/Höhenbegrenzung ausgeblendet.
- Body-Styling so anpassen, dass die Gesamthöhe konsistent ~**520 px** ergibt (Padding, Tabellen-Row-Höhe, Header-Margins), damit das iframe ohne Scroll bündig zur TWINT-Spalte schliesst.
- Auto-Refresh-Script bleibt unverändert.

### 2. `src/routes/embed-info.tsx`
- `buildAmriswilSnippet`-Default-Höhe von `640` → **`520`**.
- Aufruf in der Sektion "Lokalprognose Amriswil" ebenfalls auf `520` setzen.
- Hinweis-Text aktualisieren: "Höhe `520px` ist auf die TWINT-Spalte abgestimmt und kann bei Bedarf angepasst werden."

### 3. Keine Änderung an
- `src/components/embeds/region-lokal-noscript.tsx` (interner JSX-Fallback, nicht von WP genutzt)
- Karten-Seite `/karten/lokal` — die Bitte betrifft nur das WordPress-Embed-Snippet.

## Technische Details

- Höhen-Budget bei 520 px (innerhalb iframe, padding 12 px):
  - Aktuelles Wetter Card: ~90 px
  - Section-Header "Nächste Stunden": ~20 px
  - Tabellen-Kopf: ~28 px
  - 6 Stundenzeilen × ~34 px ≈ 204 px
  - Tagesprognose-Header + 2–3 Tage: ~140 px
  - Footer / Quelle: ~20 px
- Falls Tagesprognose nicht passt: `display:none` per Media-Query bei `max-height:520px` und stattdessen 1–2 zusätzliche Stunden zeigen — finale Tuning nach erstem Build per Browser-Screenshot.

## Verifikation

Nach Implementation:
1. `/embed-info` aufrufen, Snippet kopieren — Höhe = 520.
2. `/api/public/embed/region-lokal-static` im Preview öffnen und Screenshot machen → prüfen, dass alle Inhalte ohne Scrollbar in 520 px passen und visuell auf TWINT-Höhe enden.
