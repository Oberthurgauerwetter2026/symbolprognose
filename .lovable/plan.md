## Problem

Im aktuellen Snippet hat das `<iframe>` `height:0` **und** `loading="lazy"`. Damit ist es nie im sichtbaren Viewport (Höhe = 0), Lazy-Loading verschiebt das Laden auf unbestimmte Zeit → das iframe lädt nie, sendet kein `postMessage`, und bleibt für immer bei 0 px. Resultat: WordPress zeigt einen unsichtbaren Block.

## Fix in `src/routes/embed-info.tsx` → `buildSnippet`

1. **Start-Höhe setzen** statt `height:0`: `height:${fallbackHeight}px` (z. B. 600). Sobald das embed `postMessage` schickt, wird sie live ersetzt.
2. **`loading="lazy"` entfernen** (oder durch `loading="eager"` ersetzen) – mit Höhe > 0 wäre lazy zwar wieder safe, aber sicherer ohne, da viele WP-Themes das iframe ohnehin sofort sichtbar machen.
3. `<noscript>`-Fallback bleibt für JS-Aus.
4. `width:100%;max-width:100%;min-width:0;display:block;box-sizing:border-box;border:0` bleibt → Breite passt sich weiter dem Container an.

Resultat: iframe wird sofort mit Fallback-Höhe gerendert, lädt, und schrumpft/wächst dann via `postMessage` auf die echte Inhaltshöhe.

Keine Änderungen an `EmbedShell`, `/embed/*` Routen oder Karten.
