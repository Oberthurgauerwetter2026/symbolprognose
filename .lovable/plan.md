Ziel: Im Embed-Widget `/embed/warnungen` soll das Warn-Info-Panel bei genügend Breite rechts von der Karte stehen; auf schmalen Viewports (Mobil) soll es sich wie bisher unter der Karte stapeln.

Aktueller Zustand (geprüft):
- `src/routes/embed.warnungen.tsx` rendert `<WarnMap bare />`.
- In `src/components/maps/warn-map.tsx` Zeile 394 entscheidet der `bare`-Prop über das Layout: `bare ? "grid-cols-1" : "@3xl:grid-cols-[1fr_320px]"`. Im Embed wird also immer nur eine Spalte verwendet und das Panel liegt unter der Karte.
- `src/components/embed-shell.tsx` setzt `@container` auf dem Wrapper, sodass Container-Queries im `WarnMap`-Grid funktionieren.
- Die Iframe-Höhe für Warnungen ist in `src/routes/embed-info.tsx` auf 760 px voreingestellt.
- Das Panel wurde in der letzten Änderung bereits scrollbar gemacht (`overflow-y-auto` + flex-Layout).

Geplante Änderungen:

1. Responsives Grid im `WarnMap`-Embed-Modus
   - `grid-cols-1` als Basis beibehalten (Mobile-first).
   - Ab einer passenden Container-Breite (z. B. `@md` oder `@lg`, genauer Wert nach visuellem Test) auf `grid-cols-[1fr_260px]` oder `grid-cols-[1fr_280px]` umschalten, damit das Panel rechts neben der Karte erscheint.
   - Das `bare`-Layout darf dabei nicht mit dem nicht-baren Layout (`@3xl`) kollidieren; die neue Regel gilt nur für `bare`.

2. Panel-Höhe an das Embed-Layout koppeln
   - Damit das rechte Panel nicht höher als die Karte wird und trotzdem scrollbar bleibt, muss die maximale Höhe des Info-Panels auf Desktop auch im Embed-Modus greifen (z. B. `@md:flex @md:h-[560px] @md:flex-col` statt nur `@3xl`).
   - Der bisherige `@3xl`-Breakpunkt wird für die normale App beibehalten.

3. Iframe-Höhe prüfen / anpassen
   - Falls das Seiteneinander-Layout bei 760 px Höhe zu breit oder zu hoch wirkt, wird die empfohlene Embed-Höhe in `embed-info.tsx` leicht angepasst (z. B. 640–720 px). Erst nach Sichtprüfung entscheiden.

4. Verifikation
   - Desktop-Viewport (≥ ca. 768 px Iframe-Breite): Panel rechts neben Karte, Scrollbar funktioniert bei mehreren Warnungen.
   - Mobile-Viewport (≤ ca. 480 px Iframe-Breite): Panel unter der Karte gestapelt, keine Überlappungen, Karte tippbar.
   - Build-Check und TypeScript-Check erfolgreich.

Technische Details:
- Datei: `src/components/maps/warn-map.tsx` (Grid-Logik und Panel-Wrapper).
- Optional: `src/routes/embed-info.tsx` (Höhe des Snippets).
- Tailwind v4 Container-Queries (`@md:`, `@lg:`) werden verwendet, da der Embed-Wrapper `@container` bereitstellt.
- Keine neuen Abhängigkeiten, keine Backend- oder Datenbank-Änderungen.

Du kannst die Ansicht selbst mit dem Geräte-Button über der Vorschau auf Desktop/Tablet wechseln.