## Befund: EPS ist im Frontend verdrahtet, aber Manifest-URL ist falsch → Fallback auf Deterministisch

### Was die Logs sagen

```
[radar] forecast source: deterministic (eps no manifest, det=125)
[eps] manifest fetch https://pub-...r2.dev/radar/frames.json/radar/eps/latest.json -> 404
```

Phase 2 läuft also: `radar.functions.ts` ruft `getIconEpsManifest()` auf, sieht aber `null` und nutzt korrekt den deterministischen Pfad. Der User sieht aktuell **keine EPS-Mean-PNGs**, weil das Manifest nie geladen wird.

### Ursache

`R2_PUBLIC_URL` ist im Projekt auf den **vollen Pfad zur Frames-Datei** gesetzt
(`https://pub-...r2.dev/radar/frames.json`), nicht auf den R2-Origin. Der Radar-Loader behandelt das korrekt:

```ts
// src/lib/radar.functions.ts (funktioniert)
const url = /\/radar\/frames\.json$/i.test(trimmed)
  ? trimmed
  : `${trimmed.replace(/\/radar\/?$/i, "")}/radar/frames.json`;
```

`getIconEpsManifest` macht es jedoch falsch — es strippt nur `/radar` am Ende, nicht `/radar/frames.json`, und hängt dann `/radar/eps/latest.json` an. Resultat: doppelter Pfad → 404.

### Fix (1 Datei, 1 Funktion)

**`src/lib/icon-eps-cache.server.ts`** — Base-URL-Berechnung analog zu `fetchR2Manifest` korrigieren:

```ts
const trimmed = base.replace(/\/+$/, "");
const origin = trimmed
  .replace(/\/radar\/frames\.json$/i, "")
  .replace(/\/radar\/?$/i, "");
const url = `${origin}/radar/eps/latest.json`;
```

So funktioniert es sowohl mit `R2_PUBLIC_URL=https://pub-…r2.dev` als auch mit `R2_PUBLIC_URL=https://pub-…r2.dev/radar/frames.json` (aktueller Stand).

### Validierung nach Fix

1. Server-Log sollte zeigen: `[eps] manifest loaded: ch1=24 ch2=80` (statt 404).
2. `[radar] forecast source: eps-mean (ch1=…, ch2=…, det=…)`.
3. In `/karten/radar` werden Forecast-Frames als PNG-Overlay sichtbar — kontrastreicher, exakt im EPS-Bbox, statt der Canvas-Grid-Berechnung.

### Nicht angefasst

- `scripts/ingest_icon_eps.py` (Ingest läuft korrekt, Manifest existiert in R2).
- `radar.functions.ts` (Konsument ist bereits richtig verdrahtet, Phase 2 vom letzten Turn).
- Andere Karten (Lokal/Region/Wind/Pollen) — der Fix betrifft nur Radar-EPS.
