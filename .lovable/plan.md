## Antwort auf Frage 1

**Funktioniert MOSMIX ab Tag 6?** Ja. **Bischofszell (06678)** wird aber nur dann verwendet, wenn die Station für einen Punkt die nächste ist. Für die fünf Karten-Orte sieht die Stationszuordnung so aus (Distanz Luftlinie):

| Ort | Nächste MOSMIX-Station | Distanz |
|---|---|---|
| Horn | Altenrhein (06690) | ~9.4 km |
| Amriswil | **Güttingen (06621)** | ~6.6 km |
| Sitterdorf | **Bischofszell (06678)** | ~0.4 km |
| Münsterlingen | **Güttingen (06621)** | ~4.7 km |
| Uttwil | **Güttingen (06621)** | ~4.7 km |

Bischofszell greift also für **Sitterdorf**, Güttingen für drei weitere Punkte.

## Frage 2: Im Admin nichts ersichtlich

Stimmt — `src/routes/admin.tsx` listet aktuell nur ICON-CH1/CH2, ECMWF IFS und best_match. MOSMIX wurde beim Hinzufügen vergessen.

## Plan: Admin-Seite erweitern

In `src/routes/admin.tsx`:

### 1. MOSMIX-Karte in `MODELS` ergänzen
Neuer Eintrag zwischen IFS und best_match:
- **Name**: DWD-MOSMIX-L
- **Provider**: Deutscher Wetterdienst (opendata.dwd.de) via Server Function
- **Auflösung**: stationsbasiert (Punktprognose)
- **Members**: — (statistisches Modell, MOS)
- **Reichweite**: ~10 Tage
- **Verwendung**: ab Tag 6, vor IFS gemerged (Tag 6–7)
- **Endpoint**: `https://opendata.dwd.de/.../MOSMIX_L/single_stations/{ID}/kml/MOSMIX_L_LATEST_{ID}.kmz`

### 2. Merge-Reihenfolge-Text aktualisieren
`CH1 → CH2 → MOSMIX (ab Tag 6) → IFS → best_match`

### 3. Neue Sektion „MOSMIX-Stationszuordnung"
Neue React-Komponente unterhalb der Modelle:
- Importiert die `MOSMIX_STATIONS`-Liste (Export aus `mosmix.functions.ts` nötig — Konstante exportieren, da Top-Level statisch und Worker-Code import-protection-frei beim reinen Konstantenexport)
- Importiert die SPOTS-Liste aus `region-map.tsx` (oder extrahiert sie nach `src/data/spots.ts` für saubere Wiederverwendung)
- Rendert eine Tabelle: Ort | nächste Station | Distanz (km)

Da das Importieren von Konstanten aus `.functions.ts` problematisch sein kann (import-protection greift bei `.server.`-Suffix, nicht bei `.functions.`, aber sicherer ist Auslagerung): **Stationsliste in `src/data/mosmix-stations.ts` auslagern** und in `mosmix.functions.ts` von dort importieren. So kann auch `admin.tsx` sie clientseitig nutzen.

Ebenso: **SPOTS in `src/data/spots.ts`** auslagern.

## Geplante Dateiänderungen

1. `src/data/mosmix-stations.ts` — neue Datei mit `MOSMIX_STATIONS` + `nearestStation()` Helper
2. `src/data/spots.ts` — neue Datei mit `SPOTS`
3. `src/lib/mosmix.functions.ts` — Import aus `data/mosmix-stations.ts`
4. `src/components/region-map.tsx` — Import aus `data/spots.ts`
5. `src/routes/admin.tsx` — MOSMIX-Modellkarte + Stationszuordnungstabelle
