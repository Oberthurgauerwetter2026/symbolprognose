## Ziel

Das Blitz-Datenset vollständig aus der App entfernen. Die KNMI-Quelle ist nicht verfügbar (404), MeteoSwiss bietet Blitzdaten nicht als Open Data an.

## Schritte

1. `scripts/ingest_lightning.py` löschen
2. `.github/workflows/lightning-ingest.yml` löschen
3. `src/lib/lightning.functions.ts` löschen
4. `src/components/maps/radar-map.tsx`: Blitz-Layer-Code entfernen
5. `scripts/requirements.txt` prüfen – ggf. `h5py` entfernen wenn nicht mehr anderweitig benötigt

## Danach

- Keine neuen Ingests mehr für Blitzdaten
- Warten auf zukünftige verfügbare Quellen (MeteoSwiss API erst Ende 2026 geplant)