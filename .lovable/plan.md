## Ziel

Die Warnkarte-Abo-Seite soll für Endnutzer ausschliesslich unter der Produktions-URL `https://oberthurgauer-wetter.lovable.app/warnkarte` sichtbar und erreichbar sein. Preview-Links aus der App sollen auf die Produktion zeigen, und direkte Preview-Aufrufe der Seite sollen auf die Produktions-URL weiterleiten.

## Ist-Zustand

- Route `src/routes/warnkarte.tsx` existiert bereits unter `/warnkarte`.
- `src/components/warnings/push-opt-in.tsx` verwendet `getAppUrl("/warnkarte")`, das auf Preview-Origins die Preview-URL zurückgibt.
- `src/routes/embed.warnungen.tsx` zeigt bereits auf `${SITE_URL}/warnkarte` (Produktion).
- `warnkarte.tsx` hat noch keinen `canonical`-Link und keine `og:url`.
- Es gibt keinen Redirect von Preview- auf Produktions-Origin.

## Umsetzung

1. **Push-Opt-in-Link auf Produktion umstellen**
   - Datei: `src/components/warnings/push-opt-in.tsx`
   - `setPageUrl(getAppUrl("/warnkarte"))` → `setPageUrl(`${SITE_URL}/warnkarte`)`.
   - Damit öffnet der „In eigenem Tab öffnen“-Button immer die Produktions-URL, unabhängig davon, ob die App gerade in Preview oder Produktion läuft.

2. **SEO-Metadaten vervollständigen**
   - Datei: `src/routes/warnkarte.tsx`
   - `head()` ergänzen um:
     - `property: "og:url", content: "https://oberthurgauer-wetter.lovable.app/warnkarte"`
     - `links: [{ rel: "canonical", href: "https://oberthurgauer-wetter.lovable.app/warnkarte" }]`
   - Kein `og:image` (Nutzer möchte keines).

3. **Clientseitiger Redirect Preview → Produktion**
   - Datei: `src/routes/warnkarte.tsx`
   - In `WarnkartePage` einen `useEffect` einbauen, der prüft, ob `window.location.origin` der Produktions-Origin ist.
   - Falls nicht (z. B. `.lovableproject.com` oder `-dev.lovable.app`), `window.location.replace` auf `${SITE_URL}/warnkarte` ausführen.
   - Gilt nur für diese Route (`/warnkarte`), nicht projektweit.

4. **Validierung**
   - Build laufen lassen, um sicherzustellen, dass keine Route-Tree-Fehler entstehen.
   - Preview-URL der Warnkarte aufrufen und prüfen, ob sie auf `https://oberthurgauer-wetter.lovable.app/warnkarte` weiterleitet.
   - Push-Opt-in-Button im Embed prüfen: Link-Ziel muss Produktions-URL sein.

## Technische Details

- `ssr: false` der Route bleibt erhalten; der Redirect geschieht clientseitig im `useEffect`.
- `SITE_URL` wird aus `src/lib/site-url.ts` importiert und ist bereits auf `https://oberthurgauer-wetter.lovable.app` gesetzt.
- Keine Backend- oder Datenbankänderungen nötig.
- Keine Änderung an `src/routes/embed.warnungen.tsx` (bereits korrekt auf Produktion).
- `getAppUrl` bleibt als Utility erhalten, wird aber für diesen Abo-Link nicht mehr verwendet.
