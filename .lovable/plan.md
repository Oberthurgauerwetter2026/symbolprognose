# Blitzortung zurückrollen + Alternativen für Blitzdaten

## Zurückrollen Blitzortung

Die folgenden Änderungen von Blitzortung müssen rückgängig gemacht werden:

1.  **Dateien löschen:**
    *   `scripts/ingest_lightning.py`
    *   `.github/workflows/lightning-ingest.yml`
    *   `src/lib/lightning.functions.ts`

2.  **`src/components/maps/radar-map.tsx` zurücksetzen:**
    *   Import `getLightningStrikes` entfernen.
    *   Komponente `LightningOverlay` entfernen.
    *   `useQuery` für `lightning-strikes` entfernen.
    *   State `showLightning` entfernen.
    *   Blitze-Button wieder auf `disabled` / "bald" setzen (kein Live-Daten-Fetch).
    *   `<LightningOverlay>` aus `MapContainer` entfernen.

---

## Alternativen für Blitzdaten (Europa / CH)

| Quelle | Kosten | Account | Abdeckung | Update | Anmerkung |
|--------|--------|---------|-----------|--------|-----------|
| **Weatherbit Lightning** | Free-Tier (non-commercial) | API-Key nötig | Europa, 5-min | 5 min | Kostenlos bis ~500 calls/Tag. Key bei Weatherbit.io anmelden. |
| **DMI (Dänemark)** | Kostenlos | API-Key nötig | Nordeuropa | 5 min | Offizielle dänische API. |
| **KNMI (Niederlande)** | Kostenlos | API-Key nötig | West-Europa (NL23) | 5 min | Offizieller niederländischer Wetterdienst. |
| **Meteomatics** | Kostenpflichtig | API-Key nötig | Global | Echtzeit | Sehr zuverlässig, aber teuer. |
| **Open-Meteo** | – | – | – | – | Bietet **keine** Blitzdaten an. |

**Empfehlung:** Weatherbit oder KNMI — beide sind kostenlos, erfordern aber eine kostenlose Registrierung für einen API-Key. Die Datenqualität ist für unsere Region (CH) ausreichend.

**Wichtig:** Es gibt leider keine bekannte kostenlose Blitz-API für Europa, die komplett ohne Account funktioniert. Blitzortung war die einzige umfassende Quelle, die mit einem (geschützten) Account erreichbar war.

---

## Wie weiter?

Option A: Blitz-Layer komplett entfernen und den "Blitze"-Button auf "bald" lassen.
Option B: Eine der Alternativen (Weatherbit/KNMI/DMI) mit kostenlosem API-Key integrieren.

**Wie möchtest du fortfahren?**