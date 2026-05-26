Plan: Fix Radar-Ingest Timeout

Problem
- The radar-ingest GitHub Action läuft regelmässig in den 5-Minuten-Timeout.
- Ursache: Bei 12h Lookback sind es ~280 Frames (precip + hail-poh), die je 1–2s brauchen → Gesamt >5 min.
- Symptom: Grauer Abbruch ⊘ "The operation was canceled" nach 5 Minuten.

Changes
1. `.github/workflows/radar-ingest.yml` Zeile 16:
   `timeout-minutes: 5` → `timeout-minutes: 15`
   → Genug Spielraum für 280+ Frames; Cron läuft eh nur alle 10 Minuten, und `cancel-in-progress: false` verhindert Überlappung.

2. `.github/workflows/radar-ingest.yml` Zeile 20:
   `RADAR_LOOKBACK_HOURS: "12"` → `RADAR_LOOKBACK_HOURS: "6"`
   → Die Nowcast-Slider zeigt eh nur ~3h Historie; 6h reichen völlig und halbiert die Frame-Anzahl pro Run. Beides zusammen sollte die Laufzeit auf 3–5 Minuten drücken.

No other files touched.