## Ziel

In der Lokalprognose (`src/components/weather-widget.tsx`) werden die Parameter-Bezeichnungen (Sonnenschein, Sonne, Regen, Schnee, Wind) durch Lucide-Icons mit Tooltip ersetzt. Werte/Einheiten (mm, %, km/h, min/h, cm) bleiben als Text erhalten — nur die Beschriftungen werden ikonisiert.

## Icon-Mapping

- Regen → `CloudRain`
- Sonne / Sonnenschein → `Sun`
- Schnee → `Snowflake`
- Wind → `Wind`
- Böen → `Wind` mit kleinem Zusatz oder gleiches Icon
- Sonnenaufgang/-untergang → `Sunrise` / `Sunset` (ersetzt die ↑/↓-Pfeile in der Legende)

Alle Icons mit `aria-label` + `title` für Barrierefreiheit; einheitliche Grösse 14–16 px, `text-zinc-700`.

## Änderungen (alle in `src/components/weather-widget.tsx`)

1. **Header-Toggles (Z. 460–479)**
   - Switch „Sonnenschein": Text durch `<Sun />` ersetzen, Label bleibt als `aria-label`.
   - Switch „Schnee": Text durch `<Snowflake />` ersetzen.

2. **Day-Strip (Z. 555–565)**
   - „Wind"-Label durch `<Wind />`-Icon ersetzen.

3. **Y-Achsen-Beschriftungen der Stundenstreifen (Z. 739–741, 763–765, sowie Schnee-Block ~Z. 790)**
   - „Regen mm/3h" → `<CloudRain />` + `mm/3h`
   - „Sonne min/h" → `<Sun />` + `min/h`
   - „Schnee cm/3h" → `<Snowflake />` + `cm/3h`

4. **Legende unten (Z. 1098–1107)**
   - Farbquadrate bleiben, Text-Präfixe „Regenmenge", „Wind / Böenspitzen", „Sonnenscheindauer", „Neuschnee" werden zu Icons:
     - `<CloudRain />` mm · % (Wahrscheinlichkeit)
     - `<Wind />` km/h (Wind / Böen)
     - `<Sun />` min/h · `<Sunrise />` · `<Sunset />`
     - `<Snowflake />` cm
   - Einheiten und Werte-Beschreibung in knapper Form daneben.

5. **Import**
   - `lucide-react`: `Sun, Snowflake, CloudRain, Wind, Sunrise, Sunset` ergänzen (vorhandenen Import erweitern).

## Nicht geändert

- Wetter-Symbole (`WeatherIcon`) im Tagesstreifen/Stundenstreifen bleiben unverändert.
- Werte, Einheiten, Tabellen-Layout, Farben (CSS-Tokens) bleiben gleich.
- Keine Logik-/Datenänderungen.

## Validierung

- Sichtprüfung in Mobile-Viewport (390 px) und Desktop-Breite: Icons müssen vertikal mittig zu den Zahlen sitzen, Legende darf nicht umbrechen-chaotisch werden.
- Tooltips (`title`) prüfen.
