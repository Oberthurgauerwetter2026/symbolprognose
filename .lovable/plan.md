## Diagnose (verifiziert)

Die Seite liefert vom Server korrektes HTML (HTTP 200), bricht aber im Browser ab. Playwright zeigt den echten Fehler:

```text
The requested module '/src/routes/karten.radar.tsx?tsr-shared=1'
does not provide an export named 'def'
```

Ursache: Beim automatischen Code-Splitting der Routen werden `component`/`head` in eigene Chunks ausgelagert. Alles, was diese Chunks brauchen, muss aus dem „shared“-Teil der Routendatei exportierbar sein. In mehreren Routendateien stehen jedoch Laufzeit-Konstanten im Modul-Scope:

- `src/routes/karten.radar.tsx` – `const def = getMap("radar")`, `const RadarMap = lazy(...)`
- `src/routes/karten.satellit.tsx` – `def`, `SatelliteMap`
- `src/routes/karten.niederschlag.tsx` – `def`, `PrecipAccumMap`
- `src/routes/karten.region.tsx` – `RegionMap`
- `src/routes/karten.wind.tsx` – `def`
- `src/routes/karten.warnungen.tsx` – `def`

Weil der Router-Baum alle Routendateien lädt, reisst dieser eine kaputte Chunk-Import die gesamte App mit – daher auch auf `/karten/warnungen` nur eine weisse Seite.

## Fix

1. **Lazy-Map-Komponenten auslagern**: neue Datei `src/components/maps/lazy-maps.ts`, die `RadarMap`, `SatelliteMap`, `PrecipAccumMap`, `RegionMap` als `lazy(...)`-Exporte bereitstellt. Die Routen importieren sie nur noch.
2. **`def`-Konstanten entfernen**: In jeder betroffenen Routendatei `getMap("…")` direkt innerhalb von `head()` und innerhalb der Seitenkomponente aufrufen, statt im Modul-Scope.
3. **Restliche Routen prüfen** (`karten.lokal.tsx` mit `searchSchema`, `index.tsx`): `searchSchema` wird von `validateSearch` im geteilten Teil genutzt und ist unkritisch; nur wenn ein Chunk ihn braucht, wird er ebenfalls ausgelagert.
4. **Verifikation**: Alle Kartenrouten (`/karten/warnungen`, `/karten/radar`, `/karten/satellit`, `/karten/wind`, `/karten/region`, `/karten/niederschlag`, `/`) per Browser-Test laden und auf Konsolenfehler prüfen; Screenshot der Warnkarte als Nachweis.

Keine Änderung an Backend, Daten oder Design – rein struktureller Fix der Routendateien.
