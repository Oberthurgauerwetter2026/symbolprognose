# Radar-Nowcast: Vorzeichen-Fix + Prognose-Upgrade

## 1. Sofort-Fix: rückwärts ziehende Nowcast-Zellen

**Datei:** `src/lib/radar.functions.ts` (Wind-Fallback, ~Z. 313–325)

Open-Meteo liefert `wind_direction_*` als meteorologische Richtung „**woher** der Wind weht". Aktuell wird sie ohne Minus in eine Geschwindigkeit umgerechnet → Bewegungsvektor zeigt 180° verdreht.

Änderung:

- `u = -speed · sin(dir_rad)` (Ost-Komponente)
- `v = -speed · cos(dir_rad)` (Nord-Komponente)
- Falsches Kommentar entfernen, korrekte Konvention dokumentieren.

Zusätzlich Diagnose:

- `motionSource` und `confidence` im Manifest in der DevTools-Konsole loggen (einmaliger `console.info`), damit künftige Sign-Regressionen sofort sichtbar sind.

## 2. Mittelfristig: Prognose-Qualität auf Wetterdienst-Niveau

Aktuell: **ein globaler Bewegungsvektor** verschiebt das ganze letzte Radarbild starr um T+10…+60 min. Das ist das einfachste INCA-Verfahren und versagt bei:

- konvektiven Zellen, die sich anders bewegen als das Umfeld,
- Wachstum/Zerfall (z. B. Aufgleiten an Voralpen),
- Lebensdauer einzelner Schauer.

Vorgeschlagene Stufen (alle optional einzeln aktivierbar via Feature-Flag):

### 2a. Optical Flow pro Pixel (statt globalem Vektor)

- In `scripts/ingest_radar.py`: zusätzlich zur globalen FFT-Motion ein dichtes Vektorfeld berechnen (Farnebäck-OF aus `opencv-python-headless`, oder einfache Lucas-Kanade-Implementation in numpy auf Blöcken von 32×32 px).
- Vektorfeld als kleines Float16-Array (`u_field`, `v_field`) ins Manifest schreiben (~10 KB).
- Browser: statt eines `imageOffset` ein Canvas-Warp des letzten Radarbildes pro Pixel anwenden (existierender `PrecipOverlay` kann auf semi-Lagrangean-Advection umgebaut werden).
- Effekt: einzelne Zellen ziehen mit ihrer eigenen Strömung, Front vs. Schauer unterscheidbar.

### 2b. Historie verlängern (3 → 6 Frames, ~30 min)

- `compute_motion` nutzt nur die letzten 3 Frames. Mit 6 Frames + Median wird der Vektor stabiler, Null-Drift-Fehlalarme verschwinden.
- Optional: 2.-Ordnung-Term (lineare Beschleunigung) für T+30…+60 min.

### 2c. Wachstum/Zerfall (Trend-Korrektur)

- Pro Pixel: Trend `dR/dt` aus letzten 3 Radarbildern. Auf Nowcast-Frames anwenden mit exponentiellem Decay (Halbwertszeit ~45 min, wie bei MeteoSchweiz INCA).
- Verhindert „einfrierende" Schauer, die in Realität schon zerfallen sind.

### 2d. Blending Nowcast ↔ NWP

- Nowcast dominiert bei T+0…+30 min (Gewicht 1.0 → 0.5), ICON-CH1 dominiert ab T+60 min (Gewicht 0.0 → 1.0). Linearer Übergang.
- Aktuell harter Schnitt: Nowcast bis +60, dann ICON-CH1. Übergang ist sichtbar.

### 2f. (optional, später) RainViewer-Nowcast als Cross-Check

- RainViewer-API liefert eigenen +30-min-Nowcast weltweit gratis. Als grauer Overlay-Vergleich nutzbar — ähnlich wie wetterring.at intern Multi-Source-Blending macht.

## Reihenfolge der Umsetzung

1. **Sofort:** Fix 1 (Vorzeichen) — 1 Datei, ~5 Zeilen.
2. **Iteration 1:** 2b (Historie) + 2d (Blending) — beides ohne neue Dependencies.
3. **Iteration 2:** 2c (Wachstum/Zerfall) — Python + Manifest-Erweiterung.
4. **Iteration 3:** 2a (Optical-Flow pro Pixel) — grösster Qualitätssprung, aber neue Dependency (`opencv-python-headless` ~40 MB) und Frontend-Refactor des `PrecipOverlay`.
5. **Parallel:** 2e (AROME) — eigenständig, kann jederzeit rein.
6. **Optional später:** 2f (RainViewer).

## Technische Details

- Manifest-Schema bleibt rückwärtskompatibel (Felder additiv).
- Worker-Laufzeit: alle Schritte 2a–2c laufen in GitHub Actions (`radar-ingest.yml`), nicht im Cloudflare-Worker — keine Runtime-Einschränkungen.
- Frontend-Performance: dichtes Warp in 2a per `requestAnimationFrame` und 256×256-Subgrid bleibt < 5 ms/Frame auf Mobile.

## Was ich brauche bevor ich starte

Welche Stufen sollen jetzt rein?

- (A) Nur Fix 1 (sofort, klein).
- (B) Fix 1 + Iteration 1 (Historie + Blending).
- (C) Fix 1 + Iterationen 1–3 (volles Optical-Flow-Paket, grösster Sprung, ~1 Tag Arbeit).
- (D) Alles inkl. AROME.