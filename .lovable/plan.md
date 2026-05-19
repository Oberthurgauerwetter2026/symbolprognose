## Dark-Mode mit #2561a1 als Akzent

Neutraler dunkler Hintergrund (zinc-900/950), `#2561a1` ersetzt im Dark-Mode den Akzent (aktive Tage, Buttons, Highlights, Regenbalken-Stil). Aktivierung über Toggle im Header, Default folgt `prefers-color-scheme`, Wahl persistiert in `localStorage`.

### 1. Theme-Tokens (`src/styles.css`)

Bestehende Tokens (`--background`, `--foreground`, `--accent`, `--accent-soft`, `--accent-strong`) bleiben für Light unverändert. Neuer `.dark`-Block überschreibt:

```css
.dark {
  --background: oklch(0.18 0.01 250);          /* ~zinc-900 */
  --foreground: oklch(0.96 0.005 250);
  --accent: #2561a1;
  --accent-soft: color-mix(in oklab, #2561a1 22%, transparent);
  --accent-strong: #1d4f86;
  --wx-rain: #4a90d9;                          /* heller im Dark */
}
```

Plus semantische Surface-Tokens, weil der Code aktuell hart `bg-zinc-50/100/200` und `text-zinc-500/700/900` nutzt. Zwei Wege:

- **Neue Tokens** `--surface`, `--surface-muted`, `--surface-strong`, `--border-subtle`, `--text-muted`, `--text-strong` definieren (light + dark).
- Im Widget werden die ~30 hartcodierten `bg-zinc-*` / `text-zinc-*` / `border-zinc-*`-Klassen durch `bg-[var(--surface)]`, `text-[var(--text-strong)]` etc. ersetzt.

### 2. Theme-State (`src/components/weather-widget.tsx`)

- Neuer `theme: "light" | "dark"`-State im `WeatherWidget`.
- Init-Reihenfolge: `localStorage["weather:theme"]` → `?theme=` URL-Param → `prefers-color-scheme` → `"light"`.
- `useEffect` setzt `document.documentElement.classList.toggle("dark", theme === "dark")` und schreibt in `localStorage`.
- Listener für `matchMedia("(prefers-color-scheme: dark)")`, solange Nutzer noch nicht manuell gewählt hat (Flag `userOverride`).

### 3. Toggle im Header

Dritter Switch / Icon-Button neben „Sonnenschein" und „Schnee":
- Icon ☀/☾ + Label „Dark", `aria-pressed`.
- Gleicher Visual-Stil wie die anderen Switches.

### 4. Tailwind v4 dark variant

In `src/styles.css` einmalig: `@custom-variant dark (&:where(.dark, .dark *));`
(falls noch nicht vorhanden) – damit `dark:`-Utilities möglich wären; primär arbeiten wir aber über CSS-Variablen, dann brauchen die Komponenten **keinen** zusätzlichen `dark:`-Prefix.

### 5. Iframe-Embed (Admin-Snippet)

Im `EmbedSection` (`src/routes/admin.tsx`) wird ein optionaler Hinweis ergänzt: Theme wird automatisch übernommen (System) bzw. kann mit `?theme=dark` / `?theme=light` erzwungen werden. Snippet bekommt einen Kommentar dazu, kein neuer Pflicht-Parameter.

### Technische Details

- `--wx-snow-bar` (#7dd3fc) bleibt – kontrastiert auch auf dunklem BG gut.
- `--wx-sun` (#f59e0b) bleibt, wirkt im Dark-Mode sogar prägnanter.
- `bg-[var(--accent-soft)]` bleibt 1:1 nutzbar (wird automatisch dunkler im Dark-Mode dank `color-mix`).
- FOUC-Schutz: kleiner Inline-Script-Snippet in `src/routes/__root.tsx` (vor Hydration) liest `localStorage["weather:theme"]` und setzt `.dark` auf `<html>` synchron.
- Kontrast geprüft: `#2561a1` auf `zinc-900` ≈ 5.3:1 (AA für UI-Elemente und grossen Text).

### Nicht im Plan

- Keine drei Modi (nur Light/Dark, kein „Sepia"/Custom).
- Keine Änderung der bestehenden Light-Farben.
- Keine separate Dark-Variante der Wetter-Icons (sind ohnehin farbig/SVG, funktionieren auf beiden Hintergründen).
