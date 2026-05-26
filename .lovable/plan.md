## Ziel

Drei zusammenhängende Darstellungs-Probleme im Radar-/Niederschlags-Overlay (`src/components/maps/radar-map.tsx`) beheben:

1. **Ns über dem See sichtbar** — der Bodensee überdeckt aktuell die Niederschlagsfelder vollständig.
2. **Markante Blobs statt Balken am Kartenrand** — der äussere Rand der Daten-BBox zeigt streifige Linien statt runder Strukturen.
3. **Strukturen klar konturiert, höhere Reflektivität im Inneren** — die Felder wirken zu weich/verwaschen.

Nur Frontend / Rendering — keine Datenpipeline, keine Backend-Änderung.

## Änderungen

### A. See nicht mehr deckend (Zeile ~773–777)

```tsx
// vorher: fillOpacity: 1  → überdeckt Niederschlag
<GeoJSON
  data={LAKE}
  style={() => ({ color: "#6bb6d6", weight: 0.6, fillColor: "#7ec8e3", fillOpacity: 0.35 })}
/>
```

Reihenfolge so anpassen, dass **Lake VOR PrecipOverlay** im JSX steht (ist bereits so), und im PrecipOverlay den Canvas in einen höher liegenden Pane (`overlayPane` → custom z-index 450 via `cv.style.zIndex = "450"`) hängen, damit Canvas garantiert über Lake-SVG liegt. Lake-Kontur (`weight: 0.6`) bleibt sichtbar als Ufer-Linie, blaue Füllung scheint schwach durch und Niederschlag liegt klar darüber.

### B. Blob-Falloff am Rand statt Balken (Zeile ~298–336)

Aktuelles Verhalten: Pixel ausserhalb der Grid-BBox werden auf den nächstgelegenen Rand-Gridpunkt geklemmt (`nearest-edge clamp`) und damit weit über den Rand extrapoliert → erzeugt streifige Balken längs der Grid-Kanten.

Neu:

- **Kein Klemm-Extrapolieren** mehr. Wenn `fxRaw` oder `fyRaw` ausserhalb `[0, n-1]` liegen, bilineares Sample mit **Null als Aussenwert** (Padding 0). Das ergibt natürliche, runde Blob-Ränder, weil der Wert dort weich gegen 0 läuft, statt am Rand mit dem Rand-Wert weiterzuschmieren.
- Konkret: in `sample(arr)` jeden Eckwert durch `0` ersetzen, wenn der zugehörige Grid-Index ausserhalb liegt.
- `BUFFER` bleibt bei 3 (für Sample-Bereich), `edgeFade` wird zu **isotropem Falloff**: weiter `Math.min(...)` ist OK, aber zusätzlich `if (v < 0.05) continue;` damit unter Schwellwert nichts gezeichnet wird → echte „Blob"-Silhouetten ohne Rest-Streifen.

```ts
// pseudo
const v00 = inside(x0,y0) ? vals[i00] : 0;
// ... analog v01, v10, v11
const v = bilinear(v00, v01, v10, v11, tx, ty);
if (v < 0.05) continue;
```

### C. Schärfere Konturen / höhere Reflektivität (Zeile ~225)

CSS-Filter am Canvas:

```ts
// vorher: cv.style.filter = "blur(2px) saturate(1.7) contrast(1.3)";
cv.style.filter = "blur(1px) saturate(2.0) contrast(1.5)";
```

Plus minimale Anhebung der Alpha-Werte für hohe Reflektivitäts-Bereiche in `colorFor` (mittlere/grosse Werte erhalten volles `a = 1.0`), damit kräftige Zellen klar abgegrenzt erscheinen — kein Farb-Neuentwurf, nur Alpha-Kurve.

## Was unverändert bleibt

- Radarmessungen (PNG-Overlay) — gleiche Logik, profitiert aber automatisch von dünnerer Lake-Füllung.
- Hagel-Layer, Slider, Cross-Fade, Wind-Advection (15-min), Symbolprognose.
- Farbskalen-Werte und -Schwellwerte (nur Alpha-Feintuning).
- Lake-Geometrie, BBox, Region- und Schweiz-Konturen.

## Erwartetes Resultat

- Niederschlag zieht **über den Bodensee** ohne Cut-out.
- Aussenkanten der Karte zeigen **runde, kompakte Blobs**, keine Streifen längs Lat/Lon-Linien.
- Niederschlagszellen wirken **kontrastreicher, klarer konturiert**, mehr „Radar-Look".
