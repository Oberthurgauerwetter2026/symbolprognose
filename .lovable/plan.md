## Warum es beim Neuladen lange dauert

Beim Reload startet `fetchForecast` vier parallele Calls und wartet via `Promise.all` auf **alle**:

1. ICON-CH1 Ensemble (10 Member, 48 h)
2. ICON-CH2 Ensemble (20 Member, 120 h)
3. **ECMWF IFS Ensemble (50 Member × 8 Variablen × 168 h)** ← der dicke Brocken, oft 1–3 s
4. best_match (klein)

Erst wenn der langsamste fertig ist, rendert das Widget. React-Query cached zwar 15 min, aber nur im RAM — nach Reload ist alles weg.

## Plan (2 Eingriffe, beide rein Frontend)

### 1. Persistenter Cache → Reload zeigt sofort die letzten Daten

`@tanstack/react-query-persist-client` + `createSyncStoragePersister` (localStorage) im `QueryClientProvider` in `src/routes/__root.tsx` (bzw. wo der `QueryClient` lebt).

- `maxAge`: 1 h (alte Daten sind besser als leerer Screen)
- `staleTime` bleibt 15 min → nach Reload wird im Hintergrund revalidiert, der Nutzer sieht aber **sofort** die letzte Prognose statt Skeleton
- Key bleibt `["forecast", lat, lon]`, Persistierung passiert automatisch

Wirkung: gefühlt instantanes Reload für wiederkehrende Standorte.

### 2. Gestaffelter Fetch in `src/lib/weather.ts`

Statt `Promise.all` auf alle 4 zu warten:

- `ch1` + `best_match` parallel **awaiten** → daraus sofort einen ersten `ForecastResponse` bauen und zurückgeben (deckt Tag 1–2 vollständig + Daily/Sunrise ab).
- `ch2` und `ifs` werden zwar gestartet, aber nicht awaited für den ersten Render.

Da `fetchForecast` aktuell **eine** Promise zurückgibt, gibt es zwei saubere Varianten — bitte eine wählen:

**Variante A (minimal-invasiv, empfohlen):** Beim allerersten Aufruf nur `ch1 + best_match` awaiten und zurückgeben. Ein zweiter `useQuery`-Key (`["forecast-extended", lat, lon]`) lädt im Hintergrund `ch2 + ifs` nach und überschreibt anschließend per `queryClient.setQueryData` den Hauptkey mit der gemergten Vollversion. Das Widget zeigt Tag 1–2 sofort, Tag 3–7 erscheinen wenige hundert ms später.

**Variante B (einfacher Code, weniger Gewinn):** Nur die ECMWF-Variablenliste schlanker machen (nicht alle 8 Felder × 50 Member nötig — Wind/Snowfall/Sunshine reichen für Tag 6–7; weathercode + temperature zusätzlich). Reduziert die ECMWF-Payload um ~50 %, kein Architektur-Umbau.

Beide Varianten sind kombinierbar mit Punkt 1.

## Was unverändert bleibt

- Datenquellen, Modell-Priorität (CH1 → CH2 → IFS → best_match), Aggregation, Lückenfüller
- UI-Komponenten, Embed-Logik, 1 h/3 h-Kadenz im Detail-Panel

## Frage an dich

Welche Variante für den gestaffelten Fetch — **A** (architektonisch sauberer, max. Speed) oder **B** (kleiner Patch, ~50 % Payload-Reduktion)? Punkt 1 (persistenter Cache) baue ich in jedem Fall ein.
