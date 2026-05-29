## Ziel

`/karten/radar` zeigt für die Vorhersage-Frames (jetzt … +120 h) die echten ICON-CH1/CH2-**EPS-Ensemble-Mean-PNGs** aus R2 (`radar/eps/latest.json`) statt des aktuellen interpolierten Punkt-Grids aus Open-Meteo-`minutely_15`. Damit wird die seit Wochen befüllte EPS-Pipeline sichtbar; der Bias-korrigierte deterministische Pfad bleibt als Fallback, wenn das EPS-Manifest fehlt oder zu alt ist.

Nicht-Ziele: kein UI-Toggle für Probability-Layer (kommt später), keine Änderungen am Past-Pfad (echte CPC-PNGs), keine Änderungen an Nowcast-Logik oder Bias-Korrektur, keine neuen Ingest-Felder.

## Architektur-Entscheidungen

**1. Per-Frame-Bbox.** Das EPS-Manifest rendert mit eigener Bbox (`46.85…48.3` lat / `8.15…10.55` lon), die radar-Payload nutzt enger gefasste `imageBbox` (CPC). Die sauberste Lösung ist eine optionale `imageBbox` pro Frame in `RadarFrame`; wenn gesetzt, nutzt `radar-map.tsx` diese statt `data.imageBbox`. Das hält die Past-Frames (CPC) unverändert und lässt EPS-Frames mit ihrer eigenen Bbox rendern.

**2. Quellenwahl pro Horizont.**
- `h ≤ +33 h` und `ch1`-Step verfügbar → `ch1.meanUrl`
- sonst `h ≤ +120 h` und `ch2`-Step verfügbar → `ch2.meanUrl`
- Frequenz: ch1 jede Stunde (Manifest liefert 1-h-Schritte), ch2 jede Stunde. Die heutigen 15-min-Forecast-Frames durch ICON-Stundenanker ersetzen (Advection-Smoothing entfällt für EPS-Frames; PNGs sind 1-h-Mean, dazwischen einfach das letzte PNG halten bzw. Crossfade über `blendOpacity`).

**3. Manifest-Frische / Fallback.**
- Manifest älter als 6 h (alle Modelle) → ignorieren, deterministischer Pfad rendert.
- Manifest da, aber Horizont nicht abgedeckt → für diesen Schritt deterministischen Pfad nutzen.
- Manifest-Fetch-Fehler → schon heute `null`, Pfad funktioniert.

**4. Nowcast-Overlap unverändert.** Die existierende `overlapStartMs`-Logik (Nowcast fadet T+60…+90, ICON rampt parallel hoch) bleibt — sie operiert nur auf `tMs`, der `source`-Wert (`icon-ch1` / neu auch `icon-ch2`) ist ihr egal. `blendOpacity` wird genau wie heute gesetzt.

**5. Bias-Korrektur.** Wird auf EPS-PNGs **nicht** angewendet (PNG ist eingebrannt). Stattdessen Bias nur noch im Logging vermerken, falls EPS-Pfad aktiv ist. Für reine Fallback-Frames (Open-Meteo-Grid) bleibt die Korrektur wie heute.

## Änderungen

### `src/lib/radar.functions.ts`

1. **`RadarFrame`-Typ erweitern**: optionales `imageBbox?: { minLat; maxLat; minLon; maxLon }`. Wenn gesetzt, hat es Vorrang vor `payload.imageBbox`. Type `source` um `"icon-ch2"` erweitern (existiert schon im union).
2. **EPS-Manifest laden**: `getIconEpsManifest()` aus `./icon-eps-cache.server` zusätzlich zu `fetchR2Manifest()` / `fetchOpenMeteoCache()` in `Promise.allSettled` aufnehmen.
3. **Forecast-Frame-Aufbau umbauen**:
   - Wenn EPS-Manifest da & frisch → für jeden zukünftigen Stundenstempel den passenden `EpsStep` (ch1 bevorzugt bis +33 h, sonst ch2) suchen und einen Frame mit `precipUrl = step.meanUrl`, `imageBbox = modelEntry.bbox`, `values: []`, `source: "icon-ch1"|"icon-ch2"` pushen. `blendOpacity` für Overlap-Fenster wie bisher.
   - Frames vor `overlapStartMs` (Nowcast-Bereich) weiterhin überspringen.
   - Falls ein Stundenstempel im EPS-Horizont keinen Step hat → diesen Stempel aus dem deterministischen `ref1`-Pfad nehmen (heutige Logik), damit keine Lücken entstehen.
   - Wenn EPS-Manifest fehlt / komplett alt → kompletter Forecast-Pfad bleibt wie heute (deterministisch + Advection-Smoothing).
4. **Advection-Smoothing**: nur noch über deterministische Frames laufen lassen (`f.source==="icon-ch1" && !f.precipUrl`). EPS-PNG-Frames werden nicht advektiert.
5. **Bias-Faktor**: weiterhin berechnen, aber nur auf deterministische `values`-Frames anwenden — EPS-PNG-Frames sind davon unberührt.
6. **Logging**: einzeilig melden, welcher Pfad aktiv ist, z. B. `[radar] forecast source: eps-mean (ch1=24, ch2=80, det=0)` oder `[radar] forecast source: deterministic (eps manifest stale)`.

### `src/components/maps/radar-map.tsx`

1. In dem ImageOverlay-Block (Z. 826-841) für `precipUrl`-Frames die Bbox aus `currentFrame.imageBbox ?? data.imageBbox` ableiten.
2. `sourceLabel` um `"icon-ch2"` ergänzen ("ICON-CH2 EPS-Mean" / "ICON-CH1 EPS-Mean"); bei EPS-Frames Text leicht differenzieren, damit der Nutzer im Tooltip sieht, dass es Ensemble-Mittel ist.
3. Sonst nichts — `PrecipOverlay` (Canvas-Pfad) wird automatisch nur noch für deterministische Frames ohne `precipUrl` aktiv.

### Nicht angefasst

- `scripts/ingest_icon_eps.py`, EPS-Bbox/PNG-Format, `src/lib/icon-eps-cache.server.ts` (Reader steht), Past-Pfad, Nowcast, Hail, Wind-Smoothing-Hilfsfunktionen.

## Validierung

1. **Dev-Preview** auf `/karten/radar`: bei aktivem Manifest sollte der Forecast-Ploy nicht mehr „pixelig glatt" aussehen, sondern das echte EPS-PNG zeigen (gleiche Farbskala wie CPC). Zeitstempel-Bubble zeigt „MeteoSchweiz ICON-CH1 EPS-Mean" / „ICON-CH2 EPS-Mean".
2. **Manifest stale erzwingen** (lokal mit alter `generatedAt`) → UI fällt zurück auf heutigen Look (Canvas-Grid), kein Crash.
3. **Server-Log** beim ersten Request: eine `[radar] forecast source: …`-Zeile pro Anfrage.
4. **Übergang Nowcast → EPS** zwischen T+60 und T+90: Crossfade weiter sichtbar (Nowcast-PNG fadet aus, EPS-PNG fadet ein).

## Risiken

- **EPS-Bbox ≠ Radar-Bbox**: die EPS-PNGs ragen über die Region hinaus. Leaflet clippt sauber an der Map-View, optisch unauffällig.
- **EPS-Manifest = 1-h-Schritte**, deterministisch war 15-min. Animation wird gröber. Optionale Verfeinerung später: linearer Crossfade zwischen zwei aufeinanderfolgenden EPS-PNGs über vier 15-min-Slots via `blendOpacity` auf einem Zwischenframe — bewusst nicht in diesem Plan, um Scope klein zu halten.
- **Mean ≠ Max**: EPS-Mean unterzeichnet bei lokalen Schauern systematisch. Akzeptabel für jetzt; Probability-Layer addressiert das später.
