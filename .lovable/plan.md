## Problem

Das Icon auf dem iPhone öffnet weiterhin das komplette Wetterboard (Tabs Warnungen/Region/Lokal/Wind, Sidebar) statt der reinen Warnkarte.

Ursache (geprüft):
- `src/routes/__root.tsx` liefert im HTML fest `<link rel="manifest" href="/manifest.webmanifest">` — und dieses Manifest hat `start_url: /karten/warnungen`, `scope: /`.
- Das Warnkarten-Manifest wird in `src/routes/warnkarte.tsx` erst nach dem Laden per JavaScript eingehängt. iOS liest beim „Zum Home-Bildschirm“ das Manifest, das im ausgelieferten HTML steht — also das falsche. Zusätzlich ist die Route auf `ssr: false` gesetzt, was den Zeitpunkt weiter verzögert.

## Lösung

1. **Manifest-Link aus `__root.tsx` entfernen** (nur noch Favicon/Apple-Touch-Icon dort bleiben).
2. **Pro Seite das richtige Manifest deklarieren** – direkt im `head()` der Route, also im ausgelieferten HTML:
   - `src/routes/warnkarte.tsx` → `/warnkarte.webmanifest`
   - Hauptseiten (`index.tsx`, `karte.tsx`, `karten.*.tsx`, `admin*`) → `/manifest.webmanifest`
3. **iOS-spezifische Metatags auf `/warnkarte`** ergänzen: `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title=Warnkarte`, `apple-mobile-web-app-status-bar-style`, eigenes `apple-touch-icon`.
4. **`ssr: false` auf `/warnkarte` aufheben** bzw. so anpassen, dass das `head()` serverseitig gerendert wird; der bestehende Client-Swap bleibt als Fallback.
5. **Warnkarten-Manifest schärfen**: `scope`/`start_url` auf `/warnkarte`, eindeutige `id`, damit iOS/Android es als separate App behandeln.

## Wichtig für dich

Ein bereits hinzugefügtes Icon behält seine alten Manifest-Werte dauerhaft. Nach dem Publish bitte das alte Warnkarten-Icon vom Home-Bildschirm löschen, Safari-Tab neu öffnen (`oberthurgauer-wetter.lovable.app/warnkarte`) und erneut „Zum Home-Bildschirm“ wählen.
