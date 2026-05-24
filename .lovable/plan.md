## Ziel
Die Lovable-Vorschau soll nicht mehr regelmäßig leer werden. Karten- und Admin-Seiten sollen stabil laden, statt durch den aktuellen React-/Router-Hook-Fehler komplett zu verschwinden.

## Befund
- Die Vorschau wirft wiederholt `Invalid hook call` in TanStack Router `<AwaitInner>`.
- Gleichzeitig sind die TanStack-Pakete im Projekt nicht auf einem konsistenten Versionsstand: `@tanstack/react-router` ist neuer als `@tanstack/react-start` und `@tanstack/router-plugin`.
- Das passt zum beobachteten Verhalten: nach Hot-Reload/Dependency-Optimierung lädt die App teilweise, dann verschwindet der Inhalt.
- Die Karten- und Admin-Routen selbst existieren; das Problem liegt sehr wahrscheinlich in der Router/Start-Laufzeit-Kombination, nicht in der Karte allein.

## Umsetzung
1. **TanStack-Versionen angleichen**
   - `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-plugin` und `@tanstack/zod-adapter` auf kompatible Versionen bringen.
   - Lockfile entsprechend aktualisieren.

2. **Root-Provider stabilisieren**
   - `src/routes/__root.tsx` so anpassen, dass der Query-Persister nicht bei jedem Render neu erzeugt wird.
   - Client-only Persistenz sauber trennen, damit SSR/Hydration/Hot-Reload weniger anfällig sind.

3. **Fehler sichtbar statt leer machen**
   - Bestehende Error Boundaries behalten/leicht härten, damit bei einem Fehler eine verständliche Meldung erscheint und nicht eine komplett leere Seite.

4. **Validierung**
   - Vorschau auf `/karten/lokal`, `/karten/region`, `/embed/region-lokal` und `/admin` prüfen.
   - Console-Fehler kontrollieren, insbesondere ob `Invalid hook call` verschwunden ist.

## Nicht Teil dieses Fixes
- Keine Änderung an den Wetterdaten, Kartenpositionen oder WordPress-Embed-Snippets.
- Kein Umbau des Admin-Passwortsystems, nur Wiederherstellung der Ladefähigkeit.