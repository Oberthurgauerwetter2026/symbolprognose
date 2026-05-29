## Schriftart auf San Francisco umstellen

### Hintergrund
Aktuell nutzt das Projekt `Outfit` (Display) und `Figtree` (Body), definiert in `src/styles.css` via `--font-sans` / `--font-display`. "San Francisco" (SF Pro) ist Apples System-Font und nicht frei als Webfont verfügbar — Apple erlaubt kein Hotlinking/Self-Hosting von SF Pro auf beliebigen Websites.

### Zwei realistische Optionen

**A) System-Font-Stack (empfohlen, lizenzkonform)**
Wir setzen den nativen System-Font-Stack. Auf Apple-Geräten (macOS/iOS/iPadOS) rendert das exakt als San Francisco; auf Windows/Android/Linux fällt es sauber auf den jeweiligen System-Font zurück (Segoe UI, Roboto, …).

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
```

- Keine externen Webfont-Requests mehr (Performance ↑).
- `<link>` zu Google Fonts (Outfit/Figtree) in `src/routes/__root.tsx` wird entfernt.
- Konsistentes Erscheinungsbild auf Apple-Devices; native Optik auf anderen OS.

**B) Inter als SF-Look-alike (cross-platform identisch)**
Falls die Schrift auf ALLEN Geräten gleich aussehen muss, ersetzen wir durch `Inter` (sehr nahe an SF, frei lizenziert) — ist aber dann nicht "San Francisco", sondern nur optisch ähnlich.

### Empfohlener Umfang (Option A)

1. **`src/styles.css`**: `--font-sans` und `--font-display` auf System-Stack mit `SF Pro Text` / `SF Pro Display` umstellen.
2. **`src/routes/__root.tsx`**: Google-Fonts `<link>`-Tags für Outfit/Figtree entfernen (falls vorhanden).
3. Sonst nichts — alle Komponenten nutzen bereits `var(--font-sans)` bzw. `font-[family-name:var(--font-display)]`.

### Offene Frage
Bitte bestätige Option **A** (System-Font, echtes SF auf Apple-Geräten) oder **B** (Inter als Look-alike, überall identisch).
