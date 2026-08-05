Neues Strassenglätte-Symbol: Glatte-Oberfläche-Richtung

Ziel
Das aktuelle Strassenglätte-Symbol in der Warnkarte und in den Push-Mitteilungen durch ein professionelleres, klareres Symbol ersetzen, das ohne Auto auskommt und stattdessen das Konzept einer glatten, rutschigen Oberfläche visualisiert.

Vorgehen
1. Im Build-Modus 3–4 visuelle Alternativen als SVG/PNG generieren.
   - Variante A: Wellenförmige Schlieren / Rutschspur auf einer flachen Fläche.
   - Variante B: Abstrakte, glatte Oberfläche mit Spiegelung / Glanz-Highlights.
   - Variante C: Kombination aus Schlieren und kleinem Eis-/Frost-Detail.
   - Variante D: Einfache, aber markante wellenförmige Linie als Standalone-Symbol.
   Alle Varianten werden auf dem Warnstufe-2-Hintergrund (orange) gerendert, um Lesbarkeit zu prüfen.
2. Dem Benutzer die vier Varianten vorlegen und die favorisierte auswählen lassen.
3. Die gewählte Variante in das Projekt übernehmen:
   - SVG-Quelle in `src/components/warnings/hazard-svg.ts` ersetzen.
   - Push-Icons `public/warn-icons/glaette-1.png`, `glaette-2.png`, `glaette-3.png` neu generieren.
   - Prüfen, dass das Symbol in Karte, Legende, Admin-Tool und Push-Mitteilungen konsistent ist.
4. Build laufen lassen und visuelle Qualität in der App prüfen.

Einschränkungen
- Keine funktionale Änderung an der Warnlogik.
- Keine Text- oder Übersetzungsanpassungen.
- Push-Mitteilungs-Ziel-URL bleibt `/karten/warnungen` (bereits umgesetzt).
