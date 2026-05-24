## Ziel

Im Snippet **region-lokal** sollen Karte + Lokalprognose Amriswil komplett ohne Scroll sichtbar sein – egal wie hoch die WP-Spalte ist. Aktuell sendet das Embed seine *Inhaltshöhe* via `postMessage`, dadurch wird das iframe so hoch wie nötig → es entsteht Seiten-Scroll.

## Strategie: iframe füllt Viewport, Inhalt komprimiert sich

Wir kehren das Verhalten für **dieses eine Snippet** um:

1. **Snippet `region-lokal` in `src/routes/embed-info.tsx`** bekommt eine eigene Variante (kein `postMessage`-Resize):
   - `height: calc(100vh - <offset>px)` mit Default `100vh`
   - zusätzlich `max-height: 100vh`, `min-height: 360px`
   - Optionaler Parameter im Snippet, damit Redakteur:in eine feste Offset/Höhe wählen kann, falls über dem iframe noch ein Header sitzt (z. B. WP-Adminbar). Default reicht meist.
   - Kein `<script>` mit Höhen-Listener für diese Variante (iframe-Höhe ist viewport-getrieben, nicht inhaltsgetrieben).

2. **Route `/embed/region-lokal`** (`src/routes/embed.region-lokal.tsx`) wird zu einem Fit-to-Viewport-Layout:
   - Wrapper: `h-[100dvh] w-full flex flex-col overflow-hidden`
   - **Karte oben**: `flex-1 min-h-0` → nimmt den verbleibenden Platz, Leaflet `invalidateSize()` regelt sich via vorhandenem `ResizeObserver` in `BoundsFitter`.
   - **Lokalprognose unten**: `shrink-0`, kompakte Variante (siehe 3).
   - Kein äußeres Padding mehr in dieser Route (`EmbedShell` wird hier umgangen oder mit `p-0`-Variante genutzt), damit jeder Pixel zählt.

3. **`WeatherWidget` kompakter Modus** für Embed:
   - Neue Prop `compact?: boolean` (oder Wiederverwendung von `detailOnly` + zusätzlichem `compact`).
   - Reduziert vertikale Paddings, Schriftgrößen für Temperatur/Stunden-Streifen, blendet sekundäre Zeilen aus (z. B. „gefühlt"-Zeile bleibt, aber engere Line-Heights). Ziel: ~180–220 px Höhe statt aktuell deutlich mehr.
   - Aktiviert wird `compact` nur in `/embed/region-lokal`.

4. **`EmbedShell`** bleibt unverändert für alle anderen Embeds. Für `region-lokal` rendern wir die Route **ohne** `EmbedShell` (das `postMessage` würde sonst weiterhin Höhe melden – hier unerwünscht), oder wir geben `EmbedShell` eine Prop `fillViewport` die das Senden unterdrückt und `h-full` setzt.

## Ergebnis

- iframe ist genau so hoch wie der sichtbare Bereich neben dem Twint-Label.
- Innen passt sich die Karte dynamisch an, Lokalprognose bleibt fix-kompakt darunter.
- Auf sehr kleinen Spalten/Höhen greift `min-height: 360px` damit nichts komplett kollabiert (dort entsteht dann *Seiten*-Scroll, aber das ist Edge-Case mobile).
- Andere Snippets (`all`, einzelne Karten) bleiben wie sie sind (auto-Resize via postMessage).

## Frage

Soll ich für `region-lokal` zusätzlich einen kleinen Höhen-Wahlknopf im Snippet anbieten (z. B. `100vh` / `90vh` / `600px`), oder reicht der `100vh`-Default plus die Möglichkeit, das `height:`-Property im kopierten Snippet manuell zu ändern?
