## Fix: CSS-Fehler bleibt

**Ursache:** `@import "tailwindcss"` wird von Tailwind v4 inline expandiert (hunderte `@property`-Regeln, base layer etc.). Unser `@import url("...fonts.googleapis...")` landet danach im finalen Stylesheet → PostCSS lehnt das ab (`@import must precede all other statements`). Egal an welche Stelle wir den Font-Import in `styles.css` setzen — er kommt immer nach Tailwinds Expansion.

## Lösung

Font-Import komplett aus `src/styles.css` entfernen und stattdessen als `<link>`-Tags in den Document-Head einhängen — über die `head().links`-Konfiguration der Root-Route. Das umgeht den CSS-Import-Order-Konflikt vollständig.

### `src/styles.css`
Zeile entfernen:
```css
@import url("https://fonts.googleapis.com/...");
```

### `src/routes/__root.tsx`
In `head().links` ergänzen:
```ts
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" },
```

## Geänderte Dateien
- `src/styles.css` — Font-Import entfernen
- `src/routes/__root.tsx` — Font-Links im Head