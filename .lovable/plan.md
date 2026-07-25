## Ziel
Der gelbe Schweiz-Umriss soll nicht nur in „Schweiz & Alpen", sondern auch in der Region „Europa GeoColour" sichtbar sein.

## Änderung
`src/components/maps/satellite-map.tsx` (Zeile 491):

```text
Vorher: const showSwiss = regionId === "alpen-ch";
Nachher: const showSwiss = regionId === "alpen-ch" || regionId === "europa-geocolour";
```

Keine weiteren Anpassungen nötig — `SwissOutline` und die Render-Logik bleiben unverändert. IR-Regionen (Europa IR, Global IR) bleiben ohne Umriss, da dort ein gelber Vektor auf Graustufen weniger sinnvoll ist.
