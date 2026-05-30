# Radarkarte: deterministische ICON-CH1 + ICON-CH2 als Vorhersage

## Scope

Nur die Radarkarte (`/karten/radar`, `/embed/radar`). Andere Bereiche bleiben unangetastet.

## Endzustand

**Vorhersage-Frames:**

- **ICON-CH1 Control (Member 0)** für 0–33 h — deterministisch, scharf
- **ICON-CH2 Control (Member 0)** für 33–120 h — deterministisch, scharf

**Nicht mehr auf der Karte:**

- entfernen: ICON-CH1/CH2 EPS-Mean (geglättet) → bleibt im R2 als Backend-Daten für späteres "Unsicherheits-Overlay", wird aber nicht mehr im Default-Layer angezeigt
- entfernen: AROME-HD und der "ICON ↔ AROME"-Toggle 

**Unverändert:**

- Echte Radarmessung MeteoSchweiz (Vergangenheit)
- Nowcast (Radar-Extrapolation 0–90 min)
- Hagel-Layer (POH)

## Was geändert wird

### 1. Ingest-Script `scripts/ingest_icon_eps.py`

- Im `process_model()`-Loop: Member 0 (Control, `it.perturbed == False`) identifizieren und separat als zusätzlichen Layer behalten.
- `_emit_step()` erweitern: zusätzlich zu `_mean.png` und `_prob.png` ein drittes PNG `_det.png` rendern — gleiche Farbskala, aber aus dem Control-Member statt aus dem Mean.
- `steps_meta`-Eintrag bekommt zusätzliches Feld `detUrl`.
- Kein Bandbreiten-Mehraufwand beim GRIB-Download (Control wird ohnehin schon geladen).

### 2. Cache-Reader `src/lib/icon-eps-cache.server.ts`

- `EpsStep` um optionales `detUrl: string` erweitern.
- Sonst unverändert.

### 3. Radar-Reader `src/lib/radar.functions.ts`

- Beim Aufbau der `epsByT`-Map: bevorzugt `detUrl` lesen, Fallback auf `meanUrl` (für alte Runs ohne `_det.png` während Übergangsphase).
- CH1 und CH2 beide nutzen — wie heute schon (CH1 hat Vorrang in 0–33 h, CH2 füllt 33–120 h).
- `getAromeRadarFrames` Export entfernen (oder als deprecated Stub belassen).

### 4. UI `src/components/maps/radar-map.tsx`

- Modell-Toggle (ICON ↔ AROME) **entfernen**.
- `useQuery` vereinfacht: nur `getRadarFrames()`, kein `model`-State.
- `sourceLabel()`: AROME-Branch raus. CH1/CH2-Labels aktualisieren auf "MeteoSchweiz ICON-CH1" / "MeteoSchweiz ICON-CH2" (ohne "EPS-Mean"-Zusatz).
- `RadarFrame.source`-Typ: `"arome-hd"` raus.

### 5. `maps-config.ts`

- Radar-Description aktualisieren: "Niederschlags-Animation: −6 h MCH-Radar, Nowcast und ICON-CH1/CH2 Vorhersage bis +120 h".

## Was bewusst NICHT angefasst wird

- AROME-Ingest-Script + Workflow + Cron-Worker-Trigger: bleiben technisch bestehen, schreiben weiter in R2. Toter Code in der UI, aber kein Risiko. Separater Cleanup-Plan später wenn ICON-CH1-det 2 Wochen stabil läuft.
- EPS-Mean und Prob-PNGs werden weiterhin erzeugt und in R2 abgelegt — für zukünftige Unsicherheits-Visualisierung als Toggle.

## Migrationsphase

Erste 6–24 h nach Deploy: alte Runs im R2 haben kein `_det.png`. Der Reader fällt in dieser Zeit pro Step automatisch auf `_mean.png` zurück (gleiche URL-Struktur). Sobald der nächste CH1-Run (max. 3 h) und CH2-Run (max. 6 h) durchgelaufen sind, sieht man überall den deterministischen Control. Kein Down­time, kein Manual-Cache-Bust nötig.

## Risiken

1. **Control-Member-Identifikation in STAC**: MCH markiert den Control üblicherweise mit `perturbed=False` oder `member_id=0`. Falls die STAC-Metadaten nicht eindeutig sind, fallen wir auf "Member mit Index 0" zurück. Beim ersten Test-Run prüfen.
2. **Schärfere Bilder zeigen mehr "Wettergeräusch"** — User-Erwartung: Control-Lauf zeigt unsicherere kleinräumige Details als das geglättete Mean. Das ist gewollt, aber für Endnutzer ggf. ungewohnt. Optional könnten wir später ein dezentes räumliches Smoothing (3×3 Gauss) im Renderer ergänzen — nicht Teil dieses Plans.

## Umsetzungsreihenfolge

1. `ingest_icon_eps.py`: Control-Erkennung + `_det.png` Rendering + `detUrl` in steps_meta.
2. Workflow manuell triggern, R2 prüfen ob `_det.png` neben `_mean.png` liegt.
3. Cache-Reader + Radar-Reader anpassen (mit `meanUrl`-Fallback).
4. UI-Toggle entfernen.
5. End-to-End auf `/karten/radar` testen.