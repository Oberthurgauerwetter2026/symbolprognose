## Ziel

Glättung der Radar-Prognose etwas zurücknehmen — Iso-Bänder sollen klarer erkennbar bleiben, ohne die "Flecken" zurückzubringen.

## Änderungen (nur `src/components/maps/radar-map.tsx`, Prognose-Pfad)

1. **Off-Screen-Blur reduzieren**: `ctx.filter = "blur(1.2px)"` → `"blur(0.6px)"`.
2. **CSS-Kontrast leicht anheben**: `contrast(1.15)` → `contrast(1.25)`, damit Bandgrenzen wieder schärfer durchkommen.
3. **Alpha-Ramp-Schwelle anheben**: Ramp-Bereich `0.03 → 0.1` auf `0.05 → 0.1` verkürzen. Dämpft den weichen Halo um schwache Zellen, ohne harte Punkte zu erzeugen.

`colorForSmooth` für Prognose bleibt (verhindert die Cartoon-Sprünge); Messung-Pfad unverändert.

## Verifikation

Auf `/karten/radar` Prognose-Frame prüfen: Bänder klarer sichtbar, Ränder weiterhin weich, keine isolierten 1-Pixel-Dots.
