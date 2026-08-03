# Zellgrößen im Niederschlagsradar an die Modelle angleichen

## Ausgangslage (geprüft)

- Prognose-PNGs werden im Ingest auf einem dichten Gitter (120×140 über die Bbox, ca. 1,3 km pro Pixel) gerendert und nur von Speckles/Löchern unter 9 Pixeln bereinigt — diese Frames entsprechen der ICON-CH1-Auflösung gut.
- Im Client werden Prognose-Frames zusätzlich mit einem 3×3-Boxcar geglättet (`radar-map.tsx`, zwei Stellen) und beim Morphen bilinear aus einem geglätteten Feld interpoliert. Das verbreitert Zellen um rund eine Pixelbreite und rundet Ränder ab.

## Ziel

Die dargestellte Zellgröße soll der Modellgröße entsprechen: Glättung deutlich reduzieren, Kanten dürfen etwas härter wirken.

## Änderungen

Nur in `src/components/maps/radar-map.tsx` (reine Darstellungsschicht):

1. Die beiden `smooth3x3`-Funktionen für Grid-Prognose-Frames durch eine schwach gewichtete Variante ersetzen: Mittelpunkt mit hohem Gewicht, direkte Nachbarn nur minimal (z. B. Gewicht 12 : 1 in 4er-Nachbarschaft, Diagonalen 0). Damit bleibt die Anti-Aliasing-Wirkung an Kanten, die Fläche der Zellen wächst aber nicht mehr.
2. Im Morph-/Interpolationspfad (`ensureSmooth`) analog auf dieselbe schwach gewichtete Glättung umstellen, statt auf den flächigen 3×3-Mittelwert. Die bilineare Abtastung bleibt, damit das Warping flüssig bleibt.
3. Werte-Erhalt prüfen: Nach der Umstellung sollen Maxima einzelner Zellen nicht mehr abgesenkt werden (bisher zog der Boxcar Spitzen herunter und Ränder herauf).

Nicht Teil dieser Änderung: Ingest-Skripte, Summenkarte auf dichtes Raster, Farbskala.

## Erwartetes Ergebnis

Prognose-Zellen erscheinen in Größe und Intensitätsverteilung wie im Modell; im Gegenzug sind Ränder etwas kantiger und beim Abspielen kann leichtes Pixel-Flimmern sichtbar werden.
