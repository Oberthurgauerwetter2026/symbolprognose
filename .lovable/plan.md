## Problem

In `src/components/maps/precip-accum-map.tsx` gibt es zwei getrennte Renderpfade:

1. **On-Screen (Leaflet)** — Z. 527–550: swisstopo-Reliefkachel + See `#7ec8e3`/`#5ba8c8`, Schweiz-Linie `#0f172a` w 1.4, Thurgau-Linie `#0f172a` w 2.2.
2. **Download (`renderExportCanvas`)** — Z. 184–384: weiße Fläche + Schweiz-Fill `#f1f5f9`, See `#cfe4f5`/`#7aa9c8`, Schweiz-Linie `#cbd5e1`, Thurgau-Linie `#1e293b` w 2.5.

Der Export-Pfad wurde nicht mitgezogen, daher sieht das heruntergeladene PNG nach „alter" Karte aus.

## Änderung — `src/components/maps/precip-accum-map.tsx`, `renderExportCanvas`

Einheitliche Optik mit der On-Screen-Karte:

1. **Hintergrund**: hellgrau `#ebefeb` (gleiche Map-Background-Farbe wie Leaflet `style.background`), Schweiz-Fill leicht heller `#f7faf7` als sanftes Relief-Substitut.
2. **See**: `fill="#7ec8e3"` mit `globalAlpha=0.25` (entspricht `fillOpacity: 0.25`), Strich `#5ba8c8` lineWidth 1.2.
3. **Schweiz-Grenze**: Strich `#0f172a` `globalAlpha=0.85` lineWidth 1.4, **kein Fill**.
4. **Thurgau-Grenze**: Strich `#0f172a` `globalAlpha=0.95` lineWidth 2.2, **kein Fill**, Shadow entfernen.
5. **Heatmap**: zusätzlich `globalAlpha=0.85` (statt 0.86) beim `drawImage(off, …)`, damit Land-Untergrund leicht durchscheint wie online.
6. **Reihenfolge**: Hintergrund → Schweiz-Fill (Subtil) → Heatmap → See → Schweiz-Linie → Thurgau-Linie → Header/Legende.

`drawFC` um `globalAlpha`-Parameter erweitern (Reset via `ctx.save()/restore()`), oder vor jedem Aufruf `ctx.globalAlpha = …` setzen und danach auf 1 zurück.

Klassengrenzen/Farben (`ACCUM_CLASSES`) und Legende bleiben unverändert — die werden bereits geteilt.

## Verifikation

Nach der Änderung 12 h / 24 h / 48 h PNG herunterladen und visuell gegen die On-Screen-Karte halten — See-Türkis, Grenzlinien-Stärken und Heatmap-Transparenz müssen übereinstimmen.