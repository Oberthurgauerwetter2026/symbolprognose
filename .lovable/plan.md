## Problem

Auf `/embed-info` wird die iframe-`src` aus `window.location.origin` gebaut:

```ts
const url = typeof window !== "undefined" ? window.location.origin : "https://…";
```

- **SSR** rendert wörtlich `https://…/embed/all` in die `<pre>`-Snippets.
- **Client** rendert die echte Origin (`https://id-preview--….lovable.app`).
- React meldet daher den **Hydration-Mismatch** (siehe Runtime-Error im Log).
- Wenn Nutzer den SSR-Output kopieren (bevor Hydration durch ist) oder ihn aus dem Quelltext greifen, landet `https://…/embed/all` im WordPress – das führt zum **„Lovable proxy error (404)"**.

## Fix

In `src/routes/embed-info.tsx`:

1. `url` als State mit `useState<string | null>(null)`.
2. In `useEffect` (nur Client) `window.location.origin` setzen.
3. Solange `url === null` (SSR + erster Client-Render): in `SnippetBlock` einen neutralen Platzhalter rendern, z. B. `// Snippet wird geladen …`, und den Kopier-Button deaktivieren. Dadurch ist der HTML-Output auf Server und Client identisch → keine Hydration-Mismatch mehr, und es ist unmöglich, ein Snippet mit `https://…` zu kopieren.
4. Sobald `url` gesetzt ist, werden die echten Snippets via `buildSnippet` / `buildViewportSnippet` mit der echten Origin gerendert.

Keine anderen Dateien betroffen. Verhalten der eigentlichen Embeds (`/embed/all`, `/embed/region-lokal`, …) bleibt unverändert.

## Verifikation

- `/embed-info` neu laden → kein Hydration-Error mehr in der Konsole.
- Snippet kopieren → `src="https://id-preview--….lovable.app/embed/all"` (bzw. die jeweils aktuelle Origin), kein `https://…` mehr.
- In WordPress eingebettet → iframe lädt statt 404.
