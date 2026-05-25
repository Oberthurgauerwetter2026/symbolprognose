## Problem

Im Server-Log steht:
```
[radar] manifest fetch https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev/radar/frames.json/radar/frames.json -> 404
```

Das Secret `R2_PUBLIC_URL` wurde inklusive Pfad `/radar/frames.json` gesetzt. Der Server-Code (`src/lib/radar.functions.ts`) hängt aber selbst `/radar/frames.json` an die Basis-URL an → Pfad doppelt → 404 → Frontend zeigt "Radardaten konnten nicht geladen werden".

## Fix in zwei Schritten

**1. Secret korrigieren (du)**
`R2_PUBLIC_URL` ändern auf nur die Bucket-Basis:
```
https://pub-2273d12392334ebd9bdba291a60d5398.r2.dev
```
(ohne `/radar/frames.json` am Ende, ohne Slash)

**2. Code härten (ich)**
In `src/lib/radar.functions.ts` `fetchR2Manifest()` defensiv machen, damit beide Varianten funktionieren — egal ob das Secret mit oder ohne `/radar/frames.json` gesetzt wird. Konkret: vor dem Anhängen prüfen, ob `base` bereits auf `frames.json` endet, und in dem Fall direkt verwenden.

## Erwartung danach

- Server-Log zeigt `[radar] manifest loaded: 145 frames`
- Auf `/karten/radar` verschwindet die Fehlermeldung
- Badge zeigt die echten MeteoSchweiz-Frames

Soll ich Schritt 2 umsetzen?