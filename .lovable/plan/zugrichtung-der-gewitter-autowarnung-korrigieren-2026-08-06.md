# Zugrichtung der Gewitter-Autowarnung korrigieren

## Befund (geprüft)

Die Richtungsangabe („Zellen ziehen mit … km/h aus …") wird nicht aus der Bewegung der Zelle abgeleitet, sondern aus dem **Schwerpunkt aller** Niederschlagsflächen ≥ 8 mm/h im gesamten Kartenausschnitt (`scripts/ingest_radar.py`, Zeilen 755–766: ein einziger gewichteter Schwerpunkt über das komplette Feld). Verglichen wird dieser mit dem Schwerpunkt des Vorgängerlaufs (`prev`), `src/lib/auto-thunder.server.ts` rechnet daraus Richtung und Geschwindigkeit.

Daraus folgen drei Fehlerquellen:

1. Entsteht oder verschwindet irgendwo im Ausschnitt eine zweite Zelle, springt der Gesamtschwerpunkt — die berechnete Richtung hat dann nichts mit der Verlagerung der warnenden Zelle zu tun.
2. `prev` ist einfach der letzte geschriebene Stand. Fällt ein Lauf aus, liegen 10–20 Minuten dazwischen; der Zeitabstand wird verwendet, aber die Zuordnung „gleiche Zelle" ist nicht geprüft.
3. Die Angabe ist global: alle betroffenen Gemeinden erhalten dieselbe Richtung, auch wenn mehrere Zellen aus verschiedenen Richtungen ziehen.

Die Rechenformel selbst (Umrechnung Verschiebung → Herkunftsrichtung) ist korrekt; das Eingangssignal ist falsch.

## Änderung

1. **Verlagerung aus zwei echten Radarbildern statt aus Schwerpunkten.** Der Radar-Ingest lädt im selben Lauf nicht nur das neueste, sondern auch das vorangehende Niederschlagsfeld und bestimmt die Verschiebung durch Musterabgleich (Kreuzkorrelation) der beiden Felder. Ergebnis: ein Verschiebungsvektor in km, aus dem Richtung und Geschwindigkeit folgen.
2. **Lokal statt global.** Der Abgleich läuft in einem Fenster rund um den Oberthurgau (ca. 60 km), damit weit entfernte Zellen das Ergebnis nicht verfälschen.
3. **Plausibilitätsgrenzen.** Nur ausweisen, wenn: Zeitabstand der beiden Bilder 4–12 Minuten, genügend Niederschlagsfläche vorhanden, Geschwindigkeit zwischen 5 und 120 km/h und der Musterabgleich eindeutig ist. Sonst entfällt der Satz zur Zugbahn im Warntext ersatzlos.
4. **Warntext.** Unverändert im Wortlaut, nur eben mit belastbarer Richtung; ohne verlässliche Schätzung steht wie bisher kein Zugbahn-Satz in der Warnung.

## Technische Details

- `scripts/ingest_radar.py`: `write_region_max()` holt über die bestehende Asset-Liste die zwei neuesten `precip`-Frames, rastert beide auf die bbox und ermittelt per Verschiebungssuche (ganzzahliges Gitter, Suchradius entsprechend 120 km/h, Bewertung über Korrelation der auf ≥ 1 mm/h maskierten Felder, Subpixel-Feinung über das Korrelationsmaximum) den Vektor `dx/dy` in Grad. Geschrieben wird `motion: { dirFromDeg, kmh, dtMin, quality }`. `centroid`/`prev` entfallen aus der Datei.
- `src/lib/openmeteo-cache.server.ts`: Typ von `getRadarRegionMax()` um `motion` erweitern, `centroid`/`prev` entfernen.
- `src/lib/auto-thunder.server.ts`: Schwerpunkt-Vergleich (Zeilen 78–91) durch Lesen von `regionMax.motion` ersetzen; Filter `kmh >= 5 && kmh < 120` und `compass()` bleiben. `AutoThunderResult.motion` unverändert.
- Übergangsphase: fehlt `motion` in der Datei (alter Ingest-Stand), wird kein Zugbahn-Satz gesetzt — kein Fehler.
- `RADAR_INGEST_VERSION` und `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` gemeinsam anheben, damit die Versionsprüfung im Workflow weiter greift.
- Wirksam nach Deploy plus einem Radar-Ingest-Lauf (5-Minuten-Takt).
