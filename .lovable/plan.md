# Radar-Messung: Reset

Wir setzen die Messungs-Schicht (Ingest + Frontend) gemeinsam zurück und richten sie strikt nach **MeteoSchweiz CombiPrecip** aus. Forecast nur ICON-CH1/CH2) bleibt unverändert.

## Probleme heute

1. **Intensität:** unsere Farbskala (Schwellen + Alpha) weicht von MCH-CombiPrecip ab → leichter Regen wirkt zu kräftig / starker Regen zu blass.
2. **Zeit:** Frames werden teils mit Akkumulations-Ende, teils mit Nominal-Zeit getaggt; im Frontend „springt" die Messung gegenüber dem Slider und gegenüber dem Forecast-Übergang.

## Ziel

- PNG der Messung sieht aus wie auf [meteoschweiz.ch/wetter/wetter-und-klima-in-der-schweiz/niederschlag/aktueller-niederschlag.html](https://www.meteoschweiz.ch).
- Slider-Zeit = Zeitpunkt, den MCH für das Bild ausweist (Ende des 5-min-Intervalls, UTC korrekt nach lokal).
- Übergang Messung → Prognose ist exakt bei `now`, ohne Doppel-Frame und ohne Lücke.

## Umfang

### 1. Ingest (`scripts/ingest_radar.py`)

- **Farbskala neu** nach offizieller CombiPrecip-Legende (mm/h):
  ```text
  < 0.1    transparent
  0.1–0.3  sehr hell blau
  0.3–1    hell blau
  1–3      blau
  3–10     grün
  10–30    gelb
  30–60    orange
  60–100   rot
  ≥ 100    magenta
  ```
  Exakte RGB + Alpha aus MCH-Legende übernehmen (statt der jetzigen handgewählten Werte). Eine einzige Quelle der Wahrheit (`PRECIP_SCALE`-Konstante), exportiert sowohl für PNG als auch ins Frontend.
- **Zeitstempel-Regel vereinheitlichen:** immer `enddate+endtime` (Ende des 5-min-Akkumulations-Intervalls) als nominaler Frame-Zeitpunkt, immer UTC. Diese Zeit wandert 1:1 in `frames.json` als `t` und `sourceT`.
- **Quantisierung sauber:** harte Bänder (keine Interpolation), `nodata`/`undetect` → transparent, `< 0.1 mm/h` → transparent (kein hellblauer Schleier).
- Version-Tag hochziehen (`RADAR_INGEST_VERSION = "v17-mch-reset"`), GitHub-Workflow-`EXPECTED_RADAR_INGEST_VERSION` anpassen.
- Workflow einmal manuell antriggern, damit alte v16-PNGs ersetzt sind.

### 2. Frontend-Overlay (`src/components/maps/radar-map.tsx`, `src/styles.css`)

- Farbskala `SCALE` / `colorFor` 1:1 aus der neuen Python-Konstante übernehmen (gleiche Schwellen + RGBA wie PNG → Forecast-Canvas sieht exakt aus wie Messung-PNG).
- `.mch-precip` CSS-Filter zurück auf **neutral** (kein Blur, kein Contrast-Boost). Das PNG kommt schon korrekt quantisiert aus dem Ingest; nachträgliches Blur/Contrast verschiebt gerade die Intensität.
- ImageOverlay-`opacity` auf einen einzigen Wert (Vorschlag `0.85`) für Messung und Forecast.
- `useNowFrameIndex`: 60-s-Toleranz raus. Aktiver Frame = letzter Messungs-Frame mit `Date.parse(t) <= now`. Forecast beginnt strikt beim ersten Frame `> now`.
- Slider-Label zeigt `t` direkt (Ende-Intervall = MCH-Konvention), Tooltip schreibt „Messung 14:25" für das Bild, das die 5 Min davor abdeckt.

### 3. Konsistenz-Check (einmalig, kein Code)

- Nach Re-Ingest 3 Frames mit der MCH-Live-Karte vergleichen: Farben, Schwellen, Zeit.
- Forecast-Frame direkt nach `now` muss sich nahtlos an die Messung anschliessen (gleiche Farbe bei gleicher Intensität).

## Nicht im Umfang

- Schnee-Skala (`SNOW_SCALE`) bleibt.
- Hagel-POH bleibt.
- ICON-CH1/CH2-Pipeline, Cron, R2-Setup, Timeline-UI bleiben.

## Technische Details

- `_to_mmh` bleibt: RATE/ACRR/DBZH-Konversion ist korrekt; das Intensitäts-Problem liegt nicht hier, sondern in der Quantisierung danach.
- Die neue `PRECIP_SCALE` wird im Python-Modul als JSON serialisiert und beim Build in TS gespiegelt (manuell synchron halten ist OK; ein Kommentar in beiden Dateien zeigt auf die jeweils andere).
- Alte R2-PNGs werden nicht gelöscht — durch `RADAR_RETENTION_HOURS` fallen sie nach 24 h raus, neue PNGs ersetzen sie laufend.

## Dateien

- `scripts/ingest_radar.py` — `PRECIP_SCALE`, `_extract_time`, `RADAR_INGEST_VERSION`.
- `.github/workflows/radar-ingest.yml` — `EXPECTED_RADAR_INGEST_VERSION`.
- `src/components/maps/radar-map.tsx` — `SCALE` / `colorFor`, `useNowFrameIndex`, ImageOverlay `opacity`.
- `src/styles.css` — `.mch-precip` Filter neutralisieren.