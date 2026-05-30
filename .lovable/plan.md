## Ziel

ICON-EPS (Mean/Prob) komplett raus. Vorhersage zeigt nur noch **MCH ICON-CH1 deterministisch (Control / Member 0)** für 0–33 h und **MCH ICON-CH2 deterministisch** für 33–120 h. Gleichzeitig den aktuellen weissen Preview reparieren.

---

## Teil 1 — EPS entfernen, deterministisch-only

### A) Ingest (`scripts/ingest_icon_eps.py`)

- Datei umbenennen zu `scripts/ingest_icon_det.py` (sauberer Name, kein EPS mehr im Pfad).
- Nur noch Member 0 (Control-Run) verarbeiten — alle anderen Members werden ignoriert, also weniger GRIB-Downloads (ca. 1/12 der Bytes).
- Pro Step nur noch **eine PNG** generieren: `<run>/<model>/<step>_det.png` (kein `_mean.png`, kein `_prob.png` mehr).
- `EPS_INGEST_VERSION` → `"v3-det-only"`.
- Manifest-Format vereinfacht:
  ```json
  { "models": { "ch1": { "bbox": ..., "steps": [{"t": "...", "detUrl": "...", "maxMmh": ...}] }, "ch2": {...} } }
  ```
  (kein `meanUrl`, `probUrl`, `meanWetFrac`, `detMaxMmh` mehr.)
- GitHub-Actions-Workflow-Datei (`.github/workflows/ingest-icon-eps.yml` oder ähnlich) umbenennen + Cron-Pfad anpassen.

### B) Reader (`src/lib/icon-eps-cache.server.ts` → `icon-det-cache.server.ts`)

- Datei umbenennen.
- `EpsStep` → `DetStep` mit Feldern: `t`, `detUrl`, `maxMmh`.
- Alte Felder weg: `meanUrl`, `probUrl`, `meanMaxMmh`, `meanWetFrac`, `detMaxMmh`.

### C) `src/lib/radar.functions.ts`

- Import auf neuen Cache-Namen umstellen.
- `isStepUsable` vereinfacht zu `maxMmh > 0.05`.
- In den Forecast-Frames `precipUrl = step.detUrl` (kein Fallback auf meanUrl mehr).
- Diagnose-Log: `forecast source: det (ch1=N, ch2=M)`.

### D) Alte R2-Objekte

- `_mean.png` und `_prob.png` aus alten Runs bleiben einfach liegen (R2-Lifecycle räumt sie über Run-TTL ab). Kein aktives Cleanup nötig.

---

## Teil 2 — Weisser Preview reparieren

Aktuelle Diagnose: `TypeError: null is not an object (evaluating 'resolveDispatcher().use')` in `AwaitInner` aus `@tanstack/react-router`. React 19.2.5 ist sauber, keine Dubletten. Heisst: `use()` wird in einem Kontext aufgerufen, wo React keinen Dispatcher hat — typisch für **`PersistQueryClientProvider`-Suspense gegen einen rejected Restore-Promise**, oder ein Loader, der einen rejected Promise zurückgibt.

Schritte (in dieser Reihenfolge, nach Teil 1):

1. Hard-Reload erzwingen (Vite hat zuletzt `seroval` + `router-core/ssr/client` neu optimiert; alter Chunk kann immer noch im Browser hängen).
2. Falls weiter weiss: temporär `PersistQueryClientProvider` in `src/routes/__root.tsx` durch reinen `QueryClientProvider` ersetzen und beobachten. Wenn das hilft, lag der defekte Restore-Promise im `localStorage` (`wx-rq-cache-v1`) — Buster-Key bumpen (`buster: "v3-det"`).
3. Falls immer noch weiss: `embed.radar.tsx` / `embed.lokal.tsx` / `embed.region-lokal.tsx` haben Loader, die `getRadarFrames` / `getMultiModelForecast` aufrufen. Auf `/karten/radar` selbst gibt es keinen Loader, aber wenn ein präloadendes `<Link>` einen Loader-Error wirft, kann TanStack das in `AwaitInner` als Hook-Call-Error rendern. → Loader-Returns als plain DTOs verifizieren (kein Promise in `data:` returnt) und `errorComponent` ergänzen.
4. Browser-Tool öffnet `/karten/radar`, prüft Screenshot + Network: wenn `getRadarFrames` 500 zurückgibt, ist es ein Server-Function-Crash nach den Umbenennungen → Stack im `stack_modern--server-function-logs` lesen.

---

## Technische Details

- **Member 0 = Control**: in MCH-Open-Data EPS-GRIBs ist der unperturbierte Control-Run identisch mit dem deterministischen ICON-CH1/CH2-Lauf. Inhaltlich also keine Qualitätsänderung gegenüber dem aktuellen `_det.png`, nur Pipeline schlanker.
- **Migration**: 0–6 h nach Deploy haben alte R2-Runs noch das alte Manifest-Schema; der Reader fällt dann auf reinen Open-Meteo-Forecast zurück (`forecast source: deterministic (no manifest)`). Sobald der nächste Cron-Lauf durch ist, kommen die `_det.png` wieder.
- **Komponenten** (`radar-map.tsx`): keine Änderungen nötig, da `precipUrl` als API stabil bleibt.
- **AROME-Toggle**: bleibt entfernt (war schon im letzten Schritt raus).

---

## Was unverändert bleibt

- Echte MeteoSchweiz-Radar-PNGs (0…–6 h) via `ingest_radar.py`.
- Nowcast-Extrapolation (0…+90 min).
- Open-Meteo-Cache (`ingest_openmeteo.py`) als deterministischer Punkt-Grid-Fallback, wenn das MCH-Manifest fehlt oder zu alt ist.
- POH-Hagel-Overlay.

---

## Risiken

- Manifest-Schema-Bruch: Reader und Ingest müssen im selben Deploy gehen, sonst zeigt der Reader 0–6 h lang `forecast source: deterministic (no manifest)`. Akzeptabel.
- Weisser Preview könnte ein anderes Problem sein als oben vermutet. Schritte 1–4 in Teil 2 sind sequentiell — bei jedem Schritt erst messen, dann weiter.
