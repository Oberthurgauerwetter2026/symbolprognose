1. **Update `src/lib/push.server.ts`**
   - Import `formatRange` and `warningTitle` from `@/lib/warnings-config`.
   - Keep the notification title as hazard + level, e.g. "Gewitterwarnung (Stufe 2)". If `warning.title` is empty, fall back to `warningTitle(warning.hazard, warning.level)`.
   - Expand the body to include: warning description, affected municipalities, and validity period.
   - Example body: "Es ziehen kräftige Gewitter mit Starkregen, Hagel und Sturmböen durch. Betroffene Gemeinden: Arbon, Amriswil, Romanshorn +2. Gültig: 28.07. 14:00 – 20:00 Uhr"
   - Preserve the existing truncation for municipality lists longer than 3 items.

2. **Leave service worker unchanged**
   - `public/push-sw.js` will continue to display the server-provided title, body, tag, and icon generically.

3. **Validation**
   - Run a typecheck to confirm the new imports are used correctly.
   - After implementation, verify the next warning dispatch includes the validity period in the push body.