# Fix: ICON-CH1 / ICON-CH2 im Radar wieder aktivieren

## Root Cause

Der Debug-Endpoint zeigt `hasCache: false`, obwohl die Datei in R2 existiert (1 MB, vor 3h aktualisiert):

```
R2_PUBLIC_URL = https://pub-…r2.dev/radar/frames.json
→ openmeteo/forecast.json  ✓ HTTP 200 (existiert)
→ debug endpoint           ✗ hasCache:false
```

Grund: `r2BaseUrl()` in `src/lib/openmeteo-cache.server.ts` strippt nur `/radar/?$` am Ende, nicht `/radar/frames.json`. Resultat: der Helper baut die URL `…/radar/frames.json/openmeteo/forecast.json` → 404 → kein Cache → keine Phase 1/2 → ICON-CH1/CH2-Frames fehlen.

Der Cache selbst ist intakt (1 MB, alle Phasen). Es ist ein reines URL-Parsing-Problem im Worker.

## Fix (1 Datei)

`src/lib/openmeteo-cache.server.ts` — `r2BaseUrl()` robust machen, sodass jeder Pfad-Suffix unter Bucket-Root weggeschnitten wird:

```ts
function r2BaseUrl(): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  try {
    // Nur Origin verwenden — Bucket-Root liegt dort, /radar/… und /openmeteo/… sind Geschwister.
    return new URL(base).origin;
  } catch {
    return base.replace(/\/+$/, "").replace(/\/radar(\/.*)?$/i, "");
  }
}
```

## Verifikation

Nach dem Deploy:
1. `GET /api/public/debug/r2-cache` → `hasCache:true`, `counts.phase1>0`, `counts.phase2>0`.
2. `/karten/radar` → Frames in der Zukunft mit Labels „Prognose ICON-CH1" und „Prognose ICON-CH2" erscheinen wieder.

Keine weiteren Änderungen nötig — Python-Ingest, R2-Inhalt und Radar-Renderer sind alle korrekt.
