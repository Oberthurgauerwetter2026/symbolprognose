# Automatische Gewitterwarnung: konservativer beurteilen

## Wie es MeteoSchweiz / SRF Meteo machen

MeteoSchweiz warnt bei Gewittern grundsätzlich erst ab **Stufe 2** (erhebliche Gefahr) — eine Gewitter-Stufe 1 gibt es in der offiziellen Praxis nicht. Die Kriterien sind Spitzenwerte innerhalb der Zelle:

| Stufe | Regenintensität | Böenspitze | Hagelkorn |
|---|---|---|---|
| 2 (erheblich) | 30–50 mm/h | 90–120 km/h | 2–4 cm |
| 3 (gross) | über 50 mm/h | über 120 km/h | über 4 cm |

Entscheidend ist ausserdem, dass MeteoSchweiz nicht auf einzelne Radar-Pixel reagiert: gewarnt wird, wenn eine Zelle über eine relevante Fläche und über mehrere Messzyklen hinweg diese Intensität hält. Unsere Automatik löst dagegen aus, sobald in einem einzigen 5-Minuten-Bild eine kleine Fläche die Schwelle überschreitet — deshalb wirkt die Beurteilung zu extrem.

## Änderungen

1. **Stufen konservativer**: Stufe 1 ab 25 mm/h, Stufe 2 ab 50 mm/h, Stufe 3 ab 80 mm/h (bisher 20 / 40 / 60). Damit liegt Stufe 2 an der Obergrenze des MCH-Bereichs und Stufe 3 deutlich darüber — die Automatik stuft also im Zweifel tiefer ein statt höher.
2. **Grössere Mindestfläche**: Eine Gemeinde wird nur gewarnt, wenn mindestens 8 Radar-Pixel (~8 km²) über der Stufenschwelle liegen (bisher 3). Kleine Intensitätsspitzen einzelner Pixel lösen nichts mehr aus, auch nicht bei der Stufeneinordnung.
3. **Persistenz-Prüfung**: Eine neue Warnung entsteht erst, wenn dieselbe Gemeinde in **zwei aufeinanderfolgenden** Radarläufen (also über ~5–10 Minuten) über der Schwelle liegt. Eine bereits laufende Warnung wird wie bisher sofort weitergeführt. Auch eine Höherstufung braucht zwei Läufe, damit ein einzelner Ausreisser-Frame nicht auf Stufe 3 hochzieht.
4. **Warntexte, Push-Verhalten, 5-Minuten-Takt, Zugbahn-Angabe und das automatische Beenden bleiben unverändert.** Im Text steht weiterhin die gemessene Spitzenintensität.
5. Die Skalenanzeige im Warn-Tool wird auf 25 / 50 / 80 mm/h aktualisiert, damit Anzeige und Automatik übereinstimmen.

## Technische Details

- `src/lib/warnings-config.ts`: `THUNDER_RAIN_MMH` auf `[25, 50, 80]`; die Gewitter-Schwellenzeile „Regenintensität pro Stunde" bleibt bei den offiziellen MCH-Werten (15/30/50) als Referenz, wird aber im Hinweistext klar als MeteoSchweiz-Kriterium und nicht als Automatikschwelle bezeichnet.
- `scripts/ingest_radar.py`: `MIN_CELL_PIXELS` von 3 auf 8; `mmhArea` bleibt der `MIN_CELL_PIXELS`-höchste Wert im Gemeinderaster. `RADAR_INGEST_VERSION` und `EXPECTED_RADAR_INGEST_VERSION` in `.github/workflows/radar-ingest.yml` gemeinsam auf `v26-area8` anheben.
- `src/lib/auto-thunder.server.ts`: Persistenz über eine kleine Zustandstabelle bzw. das bestehende `job_runs`-Muster — je Gemeinde wird der letzte Kandidatenstand (Zeit + Stufe) gespeichert; eine Neuanlage/Höherstufung erfolgt nur, wenn ein Kandidat aus einem Lauf innerhalb der letzten 15 Minuten mit mindestens derselben Stufe vorliegt. Kandidaten ohne Bestätigung verfallen.
- `src/routes/admin-warnungen.tsx`: Hinweistext auf die neuen Schwellen und die Bestätigungsregel („zwei Läufe in Folge, mind. 8 km² Fläche") anpassen.
- Wirksam nach Deploy; die grössere Mindestfläche greift ab dem ersten neuen Radar-Ingest-Lauf.
