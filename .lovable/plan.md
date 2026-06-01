# Flüssige 15-min-Animation der ICON-Prognose

Messung (MeteoSchweiz-PNGs) bleibt unverändert. Fokus nur auf die Canvas-Frames der ICON-CH1-Prognose.

## Diagnose

Drei Punkte verursachen das wahrgenommene 60-min-Stocken:

1. **Anker-Werte „springen" hart**: ICON-CH1 ist nativ stündlich, Open-Meteo wiederholt denselben Wert 4× pro Stunde im `minutely_15`-Feld. Die aktuelle `buildSmoothSeries`-Logik interpoliert zwar zwischen den Stunden-Ankern, aber linear — beim Übergang Anker→Anker ist die zeitliche Ableitung unstetig (Knick), das Auge liest das als „Sprung alle 60 min".
2. **Progress läuft nur im Play-Modus**: `progress` wird nur durch den rAF-Loop hochgezählt, wenn `playing=true`. Beim Slider-Scrubben oder Pause zeigt das Canvas den reinen 15-min-Frame ohne Sub-Frame-Tween → man sieht 15-min-Snaps statt eines weichen Stroms.
3. **750 ms pro 15-min-Frame** ist im Play-Modus zwar OK, aber bei stehenden Zellen wird der Crossfade durch die quantisierten Farbbänder erst sichtbar, wenn ein Bandwechsel passiert — gefühlt „rastet" die Animation nur an Stundenkanten ein.

## Änderungen — minimal, nur Prognose-Pfad

### A. `src/lib/radar.functions.ts` — Anker-Interpolation mit Easing

In `buildSmoothSeries` die lineare Interpolation durch einen monotonen kubischen Hermite-Tween (Catmull-Rom / smoothstep zwischen je 2 benachbarten Anker-Paaren) ersetzen. Effekt:
- Werte gleiten weich von Stunde zu Stunde ohne Knick.
- An Ankerpunkten bleibt der ICON-Originalwert exakt erhalten.
- Negative Überschwinger werden mit `Math.max(0, …)` geklemmt.

Keine Änderung an Anker-Erkennung, Anker-Werten, Bias-Korrektur, oder Time-Grid (bleibt 15-min).

### B. `src/components/maps/radar-map.tsx` — Sub-15-min-Tween auch im Pause/Scrub-Modus

`progress` heute = 0 außerhalb des Play-Loops. Neu:
- Wenn `currentFrame.source !== "radar"` und `nextFrame` existiert: zusätzlich einen kontinuierlich laufenden Pause-Tween-Loop (rAF) starten, der `progress` zwischen 0…1 schwingt (Ping-Pong über z. B. 2 s). So bewegt sich das Bild auch beim Stehen, statt einer eingefrorenen 15-min-Stufe.
- Beim Slider-Drag (`onChange`): progress = 0, springt sauber auf den neuen Frame; danach übernimmt der Pause-Loop wieder.

Im Play-Modus bleibt alles wie heute (rAF + 750 ms/Frame), nur jetzt mit weichem A→B-Übergang dank Easing in A.

### C. Crossfade-Dauer im Play-Modus auf 1200 ms anheben

`FRAME_MS = 1200 / speed` statt 750. Bei den natürlichen Verlagerungs-Skalen einer ICON-Stunde ergibt das ein angenehmeres Tempo (≈ 5 s pro Modellstunde bei `speed=1`), ohne die Gesamtdauer für 24 h Prognose unangenehm zu strecken.

## Nicht angefasst

- Ingest-Skript, Open-Meteo-Anfrage, Cache, Cron, R2.
- MeteoSchweiz-PNG-Pfad und sein Snap-Verhalten.
- Farbpalette, Legende, Layout, Bias-Korrektur, Snow-Frac.
- Keine Wind-Advection, keine räumliche Verschiebung der Zellen.

## Erwartetes Ergebnis

15-min-Frames erscheinen als kontinuierlicher, weicher Fluss: Intensität schwillt zwischen Stunden­ankern monoton-glatt an/ab, statt linear-knickig. Auch im Pause-Modus „atmet" das Bild zwischen den 15-min-Stufen, statt zu rasten.
