## Problem

In der Radar-Animation (1×/2×/4×) "eiern" die Niederschlagsbänder im **Prognose-Teil** sichtbar hin und her. Die **Messungen** sind nicht betroffen und sollen unverändert bleiben.

## Ursache

In `src/components/maps/radar-map.tsx` berechnet `PrecipOverlay` für jedes Prognose-Framepaar per Phasen-Korrelation einen globalen Verschiebungsvektor (`estimateAdvection` → `advection`) und sampelt damit das aktuelle Frame vorwärts (`+t·adv`) und das nächste rückwärts (`-(1-t)·adv`). 

Pro Framepaar ist der Vektor unterschiedlich (Richtung/Betrag), und beim Übergang zum nächsten Paar kippt die Sample-Verschiebung schlagartig in eine andere Richtung. Ergebnis: die Bänder werden innerhalb eines Frames in Richtung A geschoben, im nächsten Frame in Richtung B — das sieht als sichtbares Hin-und-Her-Wackeln aus, vor allem bei 2× und 4×.

## Lösung

Im Prognose-Pfad nur noch den weichen Crossfade (Smoothstep zwischen `vals` und `nextVals`) verwenden, **ohne** advektives Resampling. Das eliminiert das Wackeln vollständig. Die Bänder bewegen sich dann nicht künstlich mit, blenden aber sauber von Position A nach Position B über — was bei stündlichen ICON-CH1-Frames der korrekte Eindruck ist.

Messungen (`contour=false`) bleiben komplett unverändert, weil sie den Advektions-Pfad ohnehin nicht nutzen.

## Änderungen

`src/components/maps/radar-map.tsx`, Funktion `PrecipOverlay`:

1. Den `advection`-`useMemo` und `advectionRef` entfernen (bzw. fest auf `{dx:0, dy:0}` setzen) — inkl. `advCacheRef` und Import-Aufruf `estimateAdvection`.
2. Den `useAdv`-Zweig in der Sampling-Schleife (Zeilen ~502–514 und ~563–566 / ~573–583) entfernen, so dass nur noch der einfache Lerp-Pfad bleibt:
   ```
   const vCur = sampleAt(vals, fxRaw, fyRaw);
   v = nextVals ? lerp(vCur, sampleAt(nextVals, fxRaw, fyRaw)) : vCur;
   ```
   (analog für `snowVals`).
3. `estimateAdvection` (und nur dafür genutzte Helfer wie ggf. die Phasen-Korrelations-Hilfsfunktionen) löschen, wenn danach keine Referenzen mehr bestehen — sonst nur die Aufrufe entfernen.

Alle anderen Teile (Messungs-Frames, Zeitleiste, Geschwindigkeitsumschaltung, Snow-Overlay, Crossfade-Easing) bleiben unverändert.

## Verifikation

- Vorschau `/karten/radar` öffnen, in den Prognose-Bereich der Zeitleiste springen, 1×/2×/4× durchspielen → Bänder ziehen weich, kein Hin-und-Her mehr.
- Messungen (Vergangenheit) sehen exakt gleich aus wie vorher.
