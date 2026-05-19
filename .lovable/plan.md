## Neue Route `/admin`

Eigene Route `src/routes/admin.tsx` mit einfachem Passwort-Gate (Passwort hartkodiert in der Datei, z. B. `wetter2026`). Eingabe wird in `sessionStorage` gemerkt, sodass kein erneutes Login pro Tab-Reload nötig ist. Kein echter Schutz — nur Sichtbarkeitsbarriere.

### Layout

```
/admin
├── Login-Karte (wenn nicht entsperrt)
└── Dashboard (wenn entsperrt)
    ├── Sektion „Datenquellen / Modelle"
    └── Sektion „Einbinden auf externer Webseite"
```

### Sektion 1 — Datenquellen / Modelle

Statische Karten je Modell mit:

| Feld | Wert |
|---|---|
| Modell | ICON-CH1-EPS |
| Anbieter | MeteoSchweiz via Open-Meteo Ensemble-API |
| Auflösung | 1 km, 11 Members |
| Reichweite | ~33 h |
| Verwendung | Tag 1–2, Ensemble-Mittel |
| Endpoint | `https://ensemble-api.open-meteo.com/v1/ensemble?models=icon_ch1_eps` |

Gleiche Tabelle für **ICON-CH2-EPS** (2 km, 21 Members, ~120 h, Tag 1–5), **ECMWF IFS Ensemble** (0.25°, 51 Members, bis 15 Tage, Tag 6–7) und **Open-Meteo best_match** (Restfelder: Niederschlagswahrscheinlichkeit, Sonnenauf-/-untergang).

Zusätzlich: Merge-Reihenfolge (`CH1 → CH2 → IFS → best_match`) und Hinweis, dass Daily-Werte clientseitig aus stündlichen Arrays aggregiert werden.

### Sektion 2 — Einbinden auf externer Webseite

Ein iframe-Snippet (Standard) mit Copy-Button — funktioniert für WordPress, Wix, statische HTML-Seiten:

```html
<iframe
  src="{origin}/"
  style="width:100%;min-height:680px;border:0;display:block"
  loading="lazy"
  title="5-Tage Wetterprognose"
></iframe>
```

`{origin}` wird zur Laufzeit aus `window.location.origin` eingesetzt. Kurze Einbinde-Anleitung darunter (3 Schritte: Code kopieren → HTML-Block einfügen → speichern).

Die bestehende Route `/embed-info` bleibt unverändert (für direkte Verlinkung), wird aber inhaltlich vom Admin-Bereich abgedeckt.

### Header

Kein sichtbarer Link auf `/admin` in der Hauptnavigation. Zugriff nur via direkter URL.

### Keine Änderungen an

- Wettermodell-Logik (`src/lib/weather.ts`)
- Bestehende UI / Theme
- Routing-Shell (`__root.tsx`, `index.tsx`)