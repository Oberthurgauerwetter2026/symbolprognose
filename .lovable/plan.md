## Problem

`/embed-info` baut den Snippet aus `window.location.origin`. Öffnest du die Seite im **Preview** (`id-preview--….lovable.app`), zeigt der kopierte iframe auf die Preview-Domain – die ist passwortgeschützt → Lovable-Login in WordPress.

Die publizierte Version (`symbolprognose.lovable.app`) ist `public`, dort funktionieren die Embeds.

## Fix

In `src/routes/embed-info.tsx`:

1. Konstante `PUBLISHED_ORIGIN = "https://symbolprognose.lovable.app"` definieren.
2. Snippets immer mit `PUBLISHED_ORIGIN` bauen – unabhängig davon, wo `/embed-info` geöffnet wird. Damit ist der kopierte Code immer korrekt, egal ob Preview oder publizierte Domain.
3. `useState`/`useEffect` für die Origin entfällt – keine Hydration-Problematik mehr.
4. Kleiner Hinweistext über den Snippets: „Snippets zeigen immer auf die publizierte URL (symbolprognose.lovable.app). Nach Code-Änderungen erst publishen, dann werden sie in WordPress sichtbar."

Keine weiteren Dateien betroffen.

## Verifikation

- `/embed-info` neu laden, ein Snippet kopieren → `src="https://symbolprognose.lovable.app/embed/..."`.
- In WordPress einfügen → iframe lädt ohne Login.
