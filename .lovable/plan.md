## Ziel
Quellenangaben für die Windanimation an den neuen CH1→CH2-Stack anpassen
(bisher steht überall noch „ICON-seamless").

## Änderungen

### 1. `src/components/maps/wind-map.tsx` (Z. 1372)
Footer-Text:
```
… · Quelle: MeteoSchweiz ICON-CH1 → ICON-CH2 via Open-Meteo — stündliche Windböen 10 m, +0 … +48 h
```

### 2. `src/lib/maps-config.ts` (Wind-Karten-Description, Z. 47)
```
description: "Animierte Windböen aus MeteoSchweiz ICON-CH1 (+0…+33 h) und ICON-CH2 (bis +48 h) — Farb-Layer, Strömungs-Partikel und Pfeile beim Zoom."
```

### 3. `src/routes/embed.wind.tsx` — prüfen
Falls dort eine Quellenangabe steht, analog auf „ICON-CH1 → ICON-CH2" umstellen (sonst überspringen).

## Was sich nicht ändert
- Andere Karten (Radar, Niederschlag, Lokalprognose, Region) — deren Datenquellen sind unverändert ICON-seamless / ICON-CH1 / DWD-MOSMIX und behalten ihre Texte.
- Keine Datenpfad- oder Cache-Änderung.

## Verifikation
- `/karten/wind` Footer zeigt „ICON-CH1 → ICON-CH2".
- Karten-Liste (Tabs / Übersicht) zeigt die neue Wind-Beschreibung.
