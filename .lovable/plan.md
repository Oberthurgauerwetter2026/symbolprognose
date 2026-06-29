## Ursache

`playStepIndices` mischt zwei Bucket-Größen (5 min Messung, 15 min Prognose) und wechselt am Jetzt-Übergang den Bucket-Key. Dadurch entsteht oft ein Step, dessen Zeit-Delta deutlich kleiner ist als die umgebenden Schritte (z. B. letzter Messframe 14:00 → erster Prognoseframe 14:05 → nächster 14:15). Der Play-Loop fährt aber jeden Step mit gleicher Wand-Zeit `FRAME_MS = 1800/speed` ab. Ein 5-Min-Step zwischen 15-Min-Steps wirkt deshalb wie ein Stop.

## Fix

Play-Loop auf **konstante Zeit-Geschwindigkeit** statt konstante Steps-pro-Sekunde umstellen. Pro Step skaliert die Wandzeit mit dem realen Zeit-Delta zum nächsten Step.

### Änderungen in `src/components/maps/radar-map.tsx` (Play-Loop ~Z. 1905–1955)

1. **Referenz-Delta bestimmen:** `REF_GAP_MS = 15 * 60_000` (Prognose-Cadence) als "Normal-Tempo". `FRAME_MS` bleibt die Wandzeit für einen Referenz-Step.
2. **Pro-Step-Dauer:** Vor jedem Tick die Wandzeit aus dem realen Delta berechnen:
   ```
   const aMs = Date.parse(frames[playStepIndices[cur]].t);
   const bMs = Date.parse(frames[playStepIndices[cur+1]].t);
   const stepWall = FRAME_MS * Math.max(0.15, (bMs - aMs) / REF_GAP_MS);
   ```
   `Math.max(0.15, …)` deckelt extrem kurze Deltas nach unten, damit ein winziger Übergangs-Step nicht 0 ms dauert (sonst flackert er weg).
3. **Tick:** statt `p += dt / FRAME_MS` → `p += dt / stepWall`. `stepWall` einmal pro Step (beim Cursor-Wechsel) berechnen und in einem Ref halten.
4. **Optional, gleiche Stelle:** doppelte Übergangs-Steps von vornherein vermeiden — beim Bucket-Wechsel in `playStepIndices` einen Kandidaten überspringen, dessen Zeit-Abstand zum vorherigen Step < 0.4 × neuer Bucket-Größe ist. Hält die Liste auch beim Scrubben/Filmstrip ruhiger.

Damit fließt Play bei 5-Min-Über­gängen entsprechend schneller durch und am Jetzt-Übergang entsteht keine wahrnehmbare Pause. Darstellung, Cadence-Wahl, Crossfade, Seam-Crossfade und Scrubbing bleiben unverändert.

### Verifikation

- `bunx tsgo --noEmit`
- Im Preview `/karten/radar`: Play starten ein paar Minuten vor "Jetzt" → Übergang Mess→Prognose läuft ohne Hänger durch; Schritte fern vom Übergang fühlen sich gleich an wie vorher.