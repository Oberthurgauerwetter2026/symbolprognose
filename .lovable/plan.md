## Änderungen in `src/components/region-map.tsx`

1. **See einheitlich einfärben**:
   - Aktuell wird der See nach den Masken gerendert, aber mit `fillOpacity 0.9` schimmert die darunterliegende Aussen-CH-Maske durch (Bodensee-Teil ausserhalb CH wirkt dunkler).
   - Fix: See-Layer `fillOpacity` auf `1` setzen, damit der ganze Bodensee gleichmässig wirkt.
   - Zusätzlich: `LAKE` auch beim `OUTSIDE_CH_MASK` als Loch ausstanzen, damit die dunkle Maske den See gar nicht erst überlagert.

2. **Feine weisse Linie an der CH-Grenze**:
   - Neuer `GeoJSON`-Layer mit `SWITZERLAND`, nur Stroke (`color: "#ffffff"`, `weight: 1.2`, `opacity: 0.95`, `fill: false`), gerendert direkt nach `OUTSIDE_CH_MASK`.
