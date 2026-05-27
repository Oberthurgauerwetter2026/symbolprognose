## Problem

Auf der Radarkarte (`/karten/radar`, sowie alle Einbettungen via `RadarMap`) wird der Bodensee als deckend blaue Fläche (`fillOpacity: 1`) über das Niederschlags-Overlay gelegt. Dadurch sind Messung **und** Prognose über dem See vollständig verdeckt — auch wenn es dort regnet/schneit.

## Lösung

Den See so rendern, dass der Niederschlag durchscheint:

**`src/components/maps/radar-map.tsx`** (Zeilen 761–765)

Die `<GeoJSON data={LAKE} … />` Schicht von einer deckenden Fläche auf eine **dezente Wasser-Tönung mit klarer Outline** ändern:

- `fillOpacity: 1` → `fillOpacity: 0.25` (See bleibt als blaue Fläche erkennbar, Niederschlag bleibt sichtbar)
- `weight: 0.6` → `weight: 1.2` und `color: "#5ba8c8"` für eine klarere Uferlinie, damit der See trotz Transparenz visuell als See lesbar bleibt

Das wirkt automatisch für **Messung** (Radar-Canvas + ImageOverlay) und **Prognose** (ICON-CH1/CH2 Frames), da beide dieselbe Karte und damit dieselbe Lake-Schicht nutzen.

## Nicht betroffen / out of scope

- `region-map.tsx` (Lokalkarten) — dort liegt der See nicht über einem Niederschlagslayer.
- `OUTSIDE_MASK` / `OUTSIDE_CH_MASK` bleiben unverändert (sie maskieren bereits korrekt um den See herum, nicht über ihn).
- Farbskala, Frame-Logik, Timeline, Tiles — keine Änderungen.

## Verifikation

Nach dem Build auf `/karten/radar`:
1. Aktuellen Frame mit Niederschlag über dem Bodensee suchen (oder Timeline in eine Prognose-Stunde mit Regen über dem See ziehen) → farbige Niederschlags-Pixel müssen jetzt auch über der Seefläche sichtbar sein.
2. Seeumriss + leichte Blautönung müssen weiterhin erkennbar sein, damit die Karte als Bodenseekarte lesbar bleibt.
