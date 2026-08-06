Satellitenbild: Zeitanzeige im Embed schöner gestalten

## Ziel
Die Zeitanzeige im Satelliten-Embed (Loop/Widget-Modus) soll visuell aufgewertet werden. Der Nutzer hat die Richtung „Glassmorphic status pill" gewählt.

## Ausgangslage
- `src/components/maps/satellite-map.tsx` zeigt im `loop`-Modus (Embed/Widget) oben rechts ein einfaches, eckiges Label mit Datum und Uhrzeit (`06.08., 05:50`).
- Derzeitiges Styling: `rounded-md border bg-card/85 px-2.5 py-1 font-mono text-xs font-medium`.
- Die Vollbildansicht mit Filmstrip-Timeline bleibt unverändert.

## Geplante Umsetzung

### Datei: `src/components/maps/satellite-map.tsx`
Den Zeit-Block im `loop`-Zweig (ca. Zeilen 625–635) ersetzen durch ein neues Design:

- Container: abgerundete Pille (`rounded-full`), nicht eckig.
- Hintergrund: semi-transparentes Schwarz (`bg-black/40`) mit `backdrop-blur-md`.
- Rahmen: sehr feiner weißer Rand (`border-white/15`).
- Schatten: dezenter `shadow-lg`.
- Inhalt von links nach rechts:
  1. Kleiner gelber Status-Punkt (`bg-[#facc15]`, `w-1.5 h-1.5 rounded-full`) mit weichem Glow-Schatten (`shadow-[0_0_8px_rgba(250,204,21,0.6)]`).
  2. Datum in leicht reduzierter Opazität (`opacity-70`).
  3. Trenner (`|` in `opacity-40`).
  4. Uhrzeit mit tabellarischen Ziffern (`font-variant-numeric: tabular-nums`) für stabile Breite beim Frame-Wechsel.
- Gesamttext: `text-xs font-medium tracking-wide text-white/95`.
- Positionierung bleibt oben rechts (`absolute right-3 top-3 z-[450]`), ggf. bei Mobil/Fullscreen leicht abgestimmt.

### Formatierung
- Beibehaltung des bestehenden `Intl.DateTimeFormat("de-CH", …)`-Outputs, aber Aufteilung in Datum und Zeit, damit die Pipe-Trenner korrekt sitzt.

### Nicht im Scope
- Keine Änderung an der Vollbild-Timeline (`FilmstripTimeline`).
- Keine Änderung an der Satellitenkarte, dem Schweiz-Umriss oder den Blitz-Layern.
- Keine neuen Funktionen oder Animationen.

## Akzeptanzkriterien
- Die Embed-Zeitanzeige erscheint als runde, gläserne Pille mit gelbem Status-Punkt.
- Datum und Zeit sind klar getrennt; die Uhrzeit springt beim Abspielen nicht in der Breite.
- Lesbarkeit auf hellen und dunklen Satellitenbildern ist gegeben.
- `bun run build` bzw. `tsgo` verläuft ohne Fehler.
