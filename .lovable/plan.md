# Blanke Embed-iframes auf manchen Geräten

## Analyse

Host: `oberthurgauerwetter.ch` (WordPress, HTTPS, kein AMP). Iframe-Ziel: `https://symbolprognose.lovable.app/embed/...` läuft über Cloudflare (HTTP 200, keine `X-Frame-Options`/`frame-ancestors` — Einbettung ist also generell erlaubt).

Wenn das iframe trotzdem auf einzelnen Geräten **komplett weiss** bleibt, sind das die wahrscheinlichen Ursachen — in dieser Reihenfolge:

1. **Content-/Tracking-Blocker** (Brave, Firefox Strict, iOS-Content-Blocker, AdGuard, uBlock): blockieren `lovable.app` als Drittpartei → iframe lädt nicht.
2. **In-App-Browser** (Facebook, Instagram, LinkedIn): Cloudflares Bot-Challenge (`__cf_bm`-Cookie) wird im iframe nicht interaktiv lösbar → Interstitial.
3. **WordPress „Visual"-Editor** statt „Code"-Editor: `<script>` wird entfernt → Höhe bleibt auf Fallback (sichtbar, aber wirkt „leer", wenn der Fallback z.B. 600 px ist und die Karte erst weiter unten Inhalt zeigt).
4. **iOS Safari `100vh`-Quirk** beim `/embed/region-lokal`-Snippet: zählt Browser-UI mit → manchmal 0 px nutzbare Höhe in bestimmten Modi (PWA, Lesemodus).
5. **Sehr alte Browser** (Safari < 15): Leaflet/Map-Layer crashen still.

Da die genauen Geräte unbekannt sind, härte ich Snippet **und** Embed-Route so, dass auch im Worst Case (kein JS, blockierter iframe, in-App-Browser) ein nutzbarer Link sichtbar bleibt — und entferne die häufigsten Stolperfallen.

## Was ich ändere

### 1) `src/routes/embed-info.tsx` — robusterer Snippet-Code

Pro Snippet:
- HTML-Attribute zusätzlich zu CSS: `width="100%"` + `height="600"` (Legacy-Themes/AMP-ähnliche Sanitizer respektieren teils nur Attribute).
- `loading="eager"`, `referrerpolicy="no-referrer-when-downgrade"`, `allow="geolocation; fullscreen"`, `scrolling="no"`.
- Direkt **unter** dem iframe ein sichtbarer Fallback-Link (`<noscript>` + zusätzlich ein „Karte in neuem Tab öffnen"-Link, der nur erscheint, wenn das iframe 0 px hoch bleibt — per kleinem Inline-Snippet im Script-Block: nach 4 s prüfen, ob `f.offsetHeight < 50`, dann Hinweis-Div einblenden).
- `100vh`-Variante: zusätzlich `height:100dvh` (per `@supports`) + sauberer Fallback `min-height: 70vh`.
- Kurzer Hinweis-Block in `/embed-info`: „Im WordPress-Editor **Custom HTML** (nicht Visual) verwenden — sonst wird `<script>` entfernt. Falls Karte in In-App-Browsern (Facebook/Instagram) leer bleibt, in externem Browser öffnen."

### 2) `src/components/embed-shell.tsx` — sichtbarer Mindest-Inhalt

- Bei `fillViewport=false`: setze `min-height: 320px` auf den Wrapper, damit selbst ohne Inhalt etwas Platz reserviert ist.
- Bei `fillViewport=true`: ersetze `h-[100dvh]` durch `h-[100svh] supports-[height:100dvh]:h-[100dvh]` + `min-h-[360px]`, plus `-webkit-fill-available`-Fallback für ältere iOS-Safaris.

### 3) `/embed/*`-Routen — generischer Fallback-Streifen

Direkt vor dem jeweiligen `<ClientOnly>` einen dezenten, immer-sichtbaren Header-Streifen ergänzen (1 Zeile, Hintergrundfarbe Brand, weisser Text + Direktlink zur vollen Karte). Sobald die Karte gerendert hat, bleibt der Streifen einfach oben stehen. Effekt: selbst wenn die JS-Karte auf einem alten Gerät crasht oder Leaflet-Tiles blockiert sind, sieht der Besucher **etwas** und einen klickbaren Ausweg statt einer weissen Fläche.

Betroffene Routen: `embed.all.tsx`, `embed.lokal.tsx`, `embed.radar.tsx`, `embed.region.tsx`, `embed.region-lokal.tsx`, `embed.wind.tsx`, `embed.pollen.tsx`.

### 4) Keine Logik-Änderungen

- Radar-Frames, Forecast-Loader, Karten-Komponenten bleiben unverändert.
- Keine API-Änderungen, kein neuer Build/Cron-Code.

## Was es **nicht** löst (ehrlich)

- Aktive Adblocker, die `lovable.app` ganz blocken — dagegen hilft nur ein eigener (Sub-)Domain-Reverse-Proxy auf deine Domain. Sag Bescheid, wenn du das einrichten willst.
- Cloudflare-Bot-Challenge in Facebook/Instagram-In-App-Browsern: hier wirkt der Fallback-Link, der den Besucher in den externen Browser schickt.

## Validierung nach der Implementierung

1. `/embed-info` neu publishen, neues Snippet in WordPress austauschen.
2. Test auf dem betroffenen Gerät (idealerweise mit aktivem Tracking-Schutz) — selbst wenn das iframe blockiert ist, muss der Fallback-Link sichtbar sein.
3. Desktop-Regression: alle Embeds rendern weiterhin wie bisher in voller Höhe.

Sag mir, ob ich so loslegen soll — oder ob du zuerst noch das genaue Gerät/den Browser von einem Betroffenen besorgen kannst (dann könnte ich gezielter fixen).
