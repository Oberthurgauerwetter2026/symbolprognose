## Ziel
Messung (PNG) und Prognose (Canvas) visuell identisch in der Farbwiedergabe darstellen — beide mit `contrast(1.1)`, ohne Blur.

## Änderungen

1. **`src/components/maps/radar-map.tsx`** (Zeile 383-384)
   - Kommentar aktualisieren: beide Layer bekommen leichten Kontrast, kein Blur.
   - `cv.style.filter` von
     ```ts
     cv.style.filter = contour ? "none" : "blur(0.8px) contrast(2.2)";
     ```
     ändern zu
     ```ts
     cv.style.filter = "contrast(1.1)";
     ```

## Was sich nicht ändert
- `src/styles.css` (`.mch-precip`) ist bereits auf `contrast(1.1)` — bleibt.
- `PRECIP_SCALE` / Farbskala — keine Änderung.
- Auflösung / Raster — keine Änderung.