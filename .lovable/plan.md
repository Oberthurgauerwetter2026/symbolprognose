## Ursache (verifiziert gegen Open-Meteo)

ICON-CH1 liefert zwar das Feld `minutely_15` für die ganzen 132 h, aber die Niederschlags-Intensität wird darin **stundenweise konstant ausgeliefert** — vier aufeinanderfolgende 15-min-Slots tragen denselben mm/15min-Wert. Beispiel von eben:

```
17:15 5.1   17:30 5.1   17:45 5.1   18:00 5.1
```

Deshalb ändern sich die NS-Felder zwischen den 15-min-Frames der Prognose nicht — die Cadence ist da, aber das Modell hat schlicht keine 15-min-Variation in der Intensität.

## Was die UI heute macht
- Backend baut korrekt 15-min-Frames in 0–24 h.
- Player läuft im 15-min-Schritt durch sie durch.
- Die Frames sehen aber pro Stunde gleich aus → "Felder bewegen sich nicht".

## Lösung: räumliche Advektion zwischen Stunden-Ankern

Anstatt Intensitäten zu erfinden oder weichzuzeichnen, **verschieben** wir das stündliche Niederschlagsfeld entlang des ICON-CH1-Windvektors. Die Zellen ziehen damit zwischen H und H+1 wirklich über die Karte — wie echtes Nowcasting. Werte werden nicht gemischt, nicht geglättet, nicht "verwässert"; sie wandern nur an einen anderen Ort.

### Wo
`src/lib/radar.functions.ts`, Phase A (15-min, 0–24 h).

### Was sich ändert
1. **Wind-Felder zusätzlich anfordern**: ICON-CH1 hourly `wind_speed_10m`, `wind_direction_10m` (oder `wind_u_10m`/`wind_v_10m`, falls verfügbar) für alle Punkte. Höhe 10 m reicht für die optische Verschiebung.
2. **Advektions-Vektor** pro Stunde: aus Wind-Komponenten je Punkt → mittlere u/v (m/s). Skalierung: konservativ ~0.7× (Bodenwind ≠ Zugbahn). Cap bei z. B. 25 m/s, um Übersprünge zu vermeiden.
3. **15-min-Frame-Erzeugung**: für jeden 15-min-Slot zwischen H und H+1:
   - Verschiebungsvektor `Δ = u·Δt`, `Δt ∈ {0, 15, 30, 45} min`.
   - Für jeden Grid-Punkt: lese Intensität an Position `(lon, lat) − Δ` (semi-Lagrangean back-trace) aus dem Stundenfeld H. Nearest-Neighbour, keine Interpolation der Werte selbst.
   - Snow analog.
4. **Quelle bleibt ehrlich**: H ist ICON-CH1, H+1 ebenso. Zwischenframes sind die *gleichen Werte an verschobener Position* — keine Mischung mit H+1.
5. **Phase B (>24 h, 1 h-Takt)**: unverändert, keine Advektion nötig.
6. **Messung (<= now)**: unverändert, echte Radar-Frames im 5-min-Takt.

### Was bewusst NICHT passiert
- Kein Crossfade zwischen H und H+1.
- Keine zeitliche Glättung der Intensität.
- Keine künstliche Verschiebung im Player; Player läuft weiter frame-genau (15 min).

### Edge Cases
- Wenn Wind-Daten fehlen oder ≈ 0 → Frames identisch zur Stunde (heutiger Zustand). Kein Fehler.
- Punkte, deren Back-Trace ausserhalb der Bbox liegen → 0 mm (Feld wandert "aus dem Bild" rein/raus, korrekt).

## Prüfen
- `/karten/radar`: Play in der Prognose startet nach `now`. NS-Zellen wandern sichtbar zwischen den vollen Stunden über die Karte, behalten dabei Form/Intensität bei.
- Im Stündlichen Anker-Frame (H, H+1) bleiben die Felder exakt wie bisher (kein "Smear").
- Bei Windstille: 15-min-Frames sehen pro Stunde gleich aus (akzeptiert — keine Bewegung weil kein Transport).
- Phase B (>24 h) unverändert stündlich.
