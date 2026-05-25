# Migration: Amriswil Weather Watch → R2-Cache

## Bestandsaufnahme

| Komponente | Aktion |
|---|---|
| `cyon-proxy/om-proxy.php` | Behalten als Fallback (2–4 Wochen), dann optional entfernen |
| `pressure-map-generator/` | **Nicht anfassen** — eigener Use-Case (SVG 1×/Tag, hat eigene IP-Strategie) |
| `src/components/OpenMeteoUsageCard.tsx` + Forecast-Komponenten | Auf R2-Cache umstellen |
| Worker-Calls zu `api.open-meteo.com` | Auf R2-Cache umstellen |

## Schritte

1. R2 prüfen / einrichten + `R2_PUBLIC_URL` im Worker-Env setzen.
2. `scripts/ingest_openmeteo.py` kopieren und anpassen:
   - BBox: ~`47.45…47.65 lat`, `9.20…9.45 lon` (Amriswil + 15km)
   - Grid: `7 × 7` reicht
   - Variablen: `temperature_2m`, `precipitation`, `weathercode`, `wind_speed_10m`
3. `.github/workflows/openmeteo-ingest.yml` kopieren.
4. Worker-Calls schrittweise umstellen (heißester Endpoint zuerst).
5. Nach 2 Wochen ohne Probleme: `cyon-proxy/` optional entfernen.

## NICHT migrieren

- `pressure-map-generator/` — läuft weiter
- Clientseitige Calls — brauchen keinen Cache
- Historische Daten (`historical-forecast-api`) — nicht zeitkritisch
