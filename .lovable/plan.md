# Ns-Radar: Performance-Fix + organischere Konturen

## Problem

Die Prognose-Schicht ist aktuell der Flaschenhals des Projekts:

- `STEP = 1` für die Prognose → bei Viewport 1737×1241 werden **~2,15 Mio Pixel** pro Redraw bearbeitet.
- Pro Pixel laufen aktuell **~8 fBm-Aufrufe** (Warp + Envelope), jeweils mit **5 Oktaven Value-Noise**. Das sind grob **80–100 Mio Noise-Lookups pro Redraw**.
- Redraw wird über `progress` getriggert → läuft mehrmals pro Sekunde während der Animation.
- Folge: Main-Thread blockiert, Karte ruckt, Tabs/Klicks fühlen sich träge an.

Gleichzeitig sollen die Konturen noch organischer wirken (keine geraden Kanten, mehr radarähnliche Zellstrukturen) — aber **ohne Glättung/Blur**.

## Lösung

### 1. Warp- und Envelope-Felder auf grobem Gitter vorberechnen

Statt 8 fBm-Aufrufe pro Bildschirm-Pixel:
- Einmal pro Redraw ein **Coarse-Field** (z. B. `WARP_STEP = 6`, also ~290×210 Stützpunkte) für die fünf benötigten Skalarfelder vorberechnen: `dX`, `dY`, `mod`, `envRaw` (+ ein zweites Envelope-Feld für mehr Organik).
- Pro Bildschirm-Pixel **bilinear interpolieren** statt fBm rechnen.
- Reduziert die teure Arbeit um Faktor ~36 ohne sichtbaren Detailverlust (Iso-Kanten kommen aus dem Modellfeld, nicht aus dem Noise-Feld).

### 2. Coarse-Field nur invalidieren wenn nötig

Das Warp-/Envelope-Feld hängt nur von `seed` (Frame-Zeit) und Map-Viewport ab — **nicht von `progress`**. Cache per `useRef` keyed nach `frame.t + map.getCenter() + zoom + size`. Während der 15-Min-Interpolation werden nur `vCur`/`vNext` neu gesampelt, das Noise-Feld wird wiederverwendet.

### 3. fBm-Oktaven reduzieren

`fbm` von 5 → 3 Oktaven. Da fBm nur noch auf dem groben Gitter berechnet wird, reichen 3 Oktaven für die organische Form locker; visuell nicht unterscheidbar.

### 4. Organischere Konturen

Innerhalb derselben Coarse-Field-Berechnung:
- **Zwei Warp-Richtungen** mit unterschiedlicher Rotation (z. B. 30° und −55°) statt einer einzigen → bricht die letzte verbleibende Vorzugsachse.
- **Drittes Envelope-Feld** mit grosser Wellenlänge für „Zell-Inseln" (echte radarähnliche Cluster) und höherem Schwellwert → mehr Löcher, mehr fingerförmige Ränder.
- Warp-Amplitude leicht erhöhen (von 5,5 → 7,0 Grid-Einheiten) für stärkere laterale Verzerrung.

Alles bleibt hartkantig: kein Blur, `imageSmoothingEnabled = false`, diskrete `colorFor`-Bänder unverändert.

### 5. STEP unverändert bei 1 für Prognose

Da der teure Teil (fBm) jetzt auf Coarse-Field liegt, bleibt `STEP = 1` möglich und die Iso-Kanten bleiben so scharf wie heute. Sollte das Profiling nach Schritt 1–3 noch zu langsam sein, fallen wir auf `STEP = 2` zurück (mit `imageSmoothingEnabled = false` kaum sichtbar).

## Betroffene Datei

- `src/components/maps/radar-map.tsx` — nur die `redrawRef.current`-Funktion (~Z. 393–597). Keine Änderungen an Datenpfad, Server-Function, Farbskala oder Mess-Radar-Rendering.

## Erwartetes Ergebnis

- Redraw-Kosten sinken um Faktor ~30–40 → keine UI-Blockade mehr während Animation.
- Konturen wirken deutlich „zellulärer" und unregelmässiger, ohne dass Bänder weich werden.
