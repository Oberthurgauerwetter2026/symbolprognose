## Problem

ICON-CH1 ist nativ stündlich. Open-Meteo füllt `minutely_15.precipitation` durch Wiederholung desselben Werts 4× pro Stunde — daher sieht die Prognose-Animation aus wie 60-min-Sprünge mit harten Block-Wechseln statt fliessender Bewegung. Zusätzlich verstärkt die quantisierte Farbskala (`colorFor` mit harten Bändern) den „Quadrate"-Eindruck.

## Lösung (nur Prognose, Messung unverändert)

### 1. Temporale Interpolation in der Prognose
In `src/lib/radar.functions.ts`, ICON-CH1-Block (ca. Zeile 309–336):
- Wiederholte Stundenwerte erkennen (4 gleiche Werte in Folge → ein stündlicher Anker).
- Zwischen zwei Stunden-Ankern pro Grid-Punkt linear interpolieren, sodass die 15-min-Frames echte Zwischenwerte bekommen.
- Glättet die zeitliche Entwicklung: Niederschlagsfeld driftet/verstärkt sich kontinuierlich statt zu springen.

### 2. Räumlich-zeitliches Smoothing im Canvas-Overlay
In `src/components/maps/radar-map.tsx` (PrecipOverlay / colorFor):
- `colorFor` zusätzlich um eine optionale weiche Variante ergänzen, die nur für Prognose-Frames (`source !== "radar"`) genutzt wird: Farbe linear zwischen zwei Bändern blenden statt hart zu quantisieren. Messung-PNG bleibt 1:1 MeteoSchweiz-Look.
- Schwächeres Quanitisierungs-Banding → keine sichtbaren rechteckigen Blöcke mehr.

### 3. Crossfade auch im Pause-Modus
Aktuell wird `blendNext` nur beim Abspielen aktiv. Zusätzlich beim Scrubben/Pausieren einen kleinen interpolierten Zwischenframe rendern, wenn der User zwischen zwei Frames steht (Slider liefert ohnehin Sub-Frame-Position über `progress`).

## Was nicht angefasst wird

- Messung (MeteoSchweiz-PNG-Overlays) bleibt komplett unverändert.
- Ingest-Skripte und Cron bleiben unverändert.
- Farbskala, Schwellen, Legende — visuell identisch, nur weicher zwischen den Stufen.

## Risiken

- Lineare Interpolation kann lokale Intensitätsspitzen leicht abschwächen. Mitigiert durch: Anker bleiben unverändert (volle Stundenwerte), nur die 3 Zwischen-Frames werden ergänzt.