## Ziel

1. **Radar-Karte** zeigt wie früher nur bis +24 h Modellprognose (ICON-CH1). Die +48-h-Erweiterung (ICON-CH2) wird ausschliesslich für die Niederschlagssummen verwendet.
2. **Pollenprognose** aus Navigation und Routen entfernen.
3. **Niederschlagssummen** ohne Passwort, als regulärer Tab unter `/karten/niederschlag`.

## Änderungen

### 1) Radar-Map: CH2 ausblenden (keine Server-Änderung)

`src/lib/radar.functions.ts` bleibt wie zuletzt — liefert weiterhin `icon-ch1`- und `icon-ch2`-Frames bis +48 h. Damit die Modellprognose im Radar wieder bei +24 h endet, in **`src/components/maps/radar-map.tsx`** die Frames vor der Anzeige filtern:

```ts
const frames = (data?.frames ?? []).filter((f) => f.source !== "icon-ch2");
```

Folge: Timeline, Crossfade, Auto-Play, Snapshot — alles unverändert, exakt wie vor der CH2-Erweiterung. `precip-accum-map.tsx` filtert weiterhin auf `icon-ch1 | icon-ch2` und nutzt damit die volle 48-h-Reihe.

### 2) Pollenprognose entfernen

- `src/routes/karten.pollen.tsx` löschen
- `src/routes/embed.pollen.tsx` löschen
- `src/lib/maps-config.ts`: Pollen-Eintrag und `"pollen"` aus `MapId`/`routePath`/`embedPath`-Unions streichen, `Flower2`-Import entfernen
- Eventuelle Verweise (z. B. `embed.all.tsx`) bereinigen — vorher mit `rg pollen src` prüfen

### 3) Niederschlagssummen öffentlich

- Datei **umbenennen**: `src/routes/intern.niederschlag.tsx` → `src/routes/karten.niederschlag.tsx`
- Route-ID auf `/karten/niederschlag` setzen, Passwort-Form (`ADMIN_PASSWORD`, `STORAGE_KEY`, `unlocked`-State) entfernen — direkt `PrecipDashboard` rendern
- In `src/lib/maps-config.ts` den `niederschlag`-Eintrag aktualisieren:
  - `routePath: "/karten/niederschlag"`
  - `internal: false` (bzw. Feld entfernen) → erscheint dadurch im `MapTabs`
  - Beschreibung „Passwortgeschützt" streichen
  - `routePath`-Union in `MapDefinition` entsprechend anpassen
- `MapTabs` braucht keine Änderung (filtert nur `internal === true` raus)
- Optional: Seite mit `DashboardLayout` + `MapTabs active="niederschlag"` umstellen, damit das Layout zu den anderen Karten passt

### 4) Verifikation

- `/karten/radar`: Timeline endet wie früher bei +24 h, keine zusätzlichen Stundenframes
- `/karten/niederschlag`: ohne Passwort erreichbar, 12-/24-/48-h-Karten zeigen unterschiedliche Werte (48 h > 24 h, mit `icon-ch1 + icon-ch2` im Footer)
- `/karten/pollen` liefert 404; Pollen-Tab fehlt in der Navigation
