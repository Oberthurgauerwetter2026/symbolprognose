## Fix: Seite lädt nicht mehr

**Ursache:** Vite/PostCSS Fehler in `src/styles.css`:
`@import must precede all other statements (besides @charset or empty @layer)`.

Die Google-Fonts-Zeile `@import url("https://fonts.googleapis.com/...")` steht in der Datei nach `@import "tailwindcss"` und `@source` — letzteres wird von Tailwind v4 zu Regelgruppen expandiert, sodass der nachfolgende `@import url(...)` ungültig wird. SSR rendert die Fehlerseite „This page didn't load".

## Lösung

In `src/styles.css` die Reihenfolge ändern: Google-Fonts-`@import url(...)` als allererste Zeile setzen, vor `@import "tailwindcss"`. Keine inhaltliche Änderung sonst.

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap");
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
…
```

## Geänderte Dateien
- `src/styles.css` — nur Zeilenreihenfolge im Kopf.