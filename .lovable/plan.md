## Ziel

1. Radar-Zeit stimmt mit MeteoSchweiz überein (aktuell 1 h Versatz, vermutlich Sommerzeit-Bug).
2. Die zuletzt eingeführten zusätzlichen Zeit-Infos im Slider und auf der Karte wieder entfernen.
3. Farbskala nur anpassen, falls für die Intensitäts-Übereinstimmung nötig.

## 1) 1-Stunden-Versatz (Sommerzeit)

Hypothese: MeteoSchweiz-CPC-Dateinamen (`cpcYY DOY HH MM`) werden in `scripts/ingest_radar.py` (`parse_ts_from_filename`) hart als **UTC** interpretiert. Das stimmt im Winter, aber das offizielle MCH-Radar-Bild auf
`meteoschweiz.admin.ch/.../niederschlag.html` zeigt Lokalzeit (CEST = UTC+2 im Sommer). Der Vergleich des Endpoints
`latestPrecipTs: 2026-05-31T16:00:00Z` (→ 18:00 CEST im Browser) gegen die MCH-Seite ergibt nach Userangabe genau 1 h zu spät → die Dateinamen sind tatsächlich bereits in **MEZ (UTC+1, ohne DST)** geliefert, nicht UTC.

Vorgehen:
- Im Ingest die geparste Zeit von „UTC" auf „Europe/Zurich Standardzeit (UTC+1, ohne DST)" umstellen: `dt_utc = naive_local.replace(tzinfo=timezone(timedelta(hours=1))).astimezone(timezone.utc)`. Damit wandert die gespeicherte ISO-Zeit um 1 h zurück und ergibt im Browser im Sommer wieder die korrekte CEST-Anzeige.
- Vor dem Roll-out per `curl` gegen einen aktuellen MCH-Frame gegenprüfen (Dateiname vs. tatsächlicher MCH-Anzeigezeitpunkt), damit wir nicht im Winter einen umgekehrten Bug einbauen. Falls sich zeigt, dass die Dateinamen ganzjährig in Lokal-CH (DST-aware) sind, stattdessen `ZoneInfo("Europe/Zurich")` für den Naive→UTC-Konvertierungspfad benutzen.
- `RADAR_INGEST_VERSION` von `v10-cpc-quantity-fix` → `v11-cpc-tz-fix` bumpen, Workflow-`EXPECTED_RADAR_INGEST_VERSION` mitziehen, damit alte Frames (mit falschem TZ-Label) sauber rausrotieren.

Hinweise für den Build-Loop:
- Nur `scripts/ingest_radar.py` + `.github/workflows/radar-ingest.yml` anfassen, kein Frontend-Zeitcode (Browser-`toLocaleString` ist bereits DST-korrekt).
- Bestehende R2-Frames mit alter UTC-Annahme rotieren binnen Lookback (`RADAR_LOOKBACK_HOURS=6`) aus; während der Übergangsphase kann die Karte gemischte Stände zeigen — das ist ok.

## 2) Zusätzliche Zeit-Infos wieder entfernen

In `src/components/maps/radar-map.tsx`:

- `fmtBubble` zurück auf den schlanken Stand vor den Transparenz-Änderungen:
  - Nowcast: `"Nowcast: So, HH:MM"` (kein `· Basis HH:MM` mehr).
  - Forward-Fill / fehlende Messung: gleicher Stil wie ein normaler Radar-Frame, ohne `Messung fehlt · Bild …`-Präfix und ohne `(vor X min)`-Suffix.
  - Radar-Messung: nur `"Messung: Wd, HH:MM"`.
- Den neuen „Bildbasis"-Badge im Map-Overlay (Zeilen ~1067–1071) komplett entfernen — übrig bleibt nur der Quellen-Badge + `fmtTime(currentFrame.t)`.
- `RadarFrame.sourceT` / `isFilled` bleiben in `src/lib/radar.functions.ts` erhalten (kein Refactor des Datenmodells), werden aber im UI nicht mehr gelesen — kein Funktionsverlust, nur weniger visuelles Rauschen.

## 3) Farbskala

- Erst nach dem TZ-Fix beurteilen: oft erklärt der Zeitversatz die wahrgenommene Intensitäts-Diskrepanz (alter Frame mit anderer Wetterlage).
- Falls danach immer noch zu „heiss" gegenüber MCH:
  - In `SCALE` (radar-map.tsx, ~Zeile 62) die obersten Bänder leicht entschärfen (z. B. 40 → orange-rot statt rein rot, 60 → magenta erst ab 80). Konkrete Schwellen erst nach visuellem Vergleich Screenshot ↔ MCH festlegen.
- Falls die Übereinstimmung bereits gut ist: Skala unverändert lassen.

## Technische Details

```text
ingest_radar.py
  parse_ts_from_filename():
    naive = datetime(year, 1, 1) + timedelta(days=doy-1, hours=h, minutes=mi)
    # NEU: MCH-Dateinamen sind in MEZ (UTC+1, kein DST)
    return naive.replace(tzinfo=timezone(timedelta(hours=1))).astimezone(timezone.utc)

radar-map.tsx
  fmtBubble(d, frame):
    if frame?.source === "nowcast" return `Nowcast: ${wd}, ${hh}:${mm}`
    if frame?.source === "radar"   return `Messung: ${wd}, ${hh}:${mm}`
    return `${isForecast?"Prognose":"Messung"}: ${wd}, ${hh}:${mm}`

  Overlay (≈1062–1072): Bildbasis-<span> löschen.
```

## Verifikation

- Nach Deploy: `/api/public/debug/r2-cache` → `latestPrecipTs` sollte gegenüber jetzt **1 h früher** sein.
- Radar-Karte: Zeit in Slider + Badge stimmt mit MCH-Niederschlagskarte überein (im Sommer = CEST).
- Slider-Bubble + Karten-Badges enthalten keine `Bildbasis` / `Basis HH:MM` / `Messung fehlt` / `(vor X min)` Texte mehr.
