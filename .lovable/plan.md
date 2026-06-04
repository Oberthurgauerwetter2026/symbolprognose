## Problem

Der Snippet "Lokalprognose Amriswil" (`/embed/region-lokal`) zeigt auf dem zweiten Bildschirm in deinem Geschäft (oberthurgauerwetter.ch) nur den dezenten blauen Wrapper-Hintergrund — kein Inhalt.

Ursache: Der Embed-Inhalt wird heute **ausschliesslich client-seitig** gerendert. Der Loader liefert `EMPTY_NOSCRIPT` (leere Stunden- und Tagesarrays), also enthält das HTML, das der Server ausliefert, keinerlei Prognose. Sobald der Browser die JS-Bundles aus irgendeinem Grund nicht laden kann (alter Browser, Adblocker, schlechtes Netz, stale Chunk-Hashes nach Re-Deploy, In-App-Webviews, Kiosk-Browser) bleibt das iframe sichtbar leer — und der blaue Wrapper aus dem Snippet ist das Einzige, was zu sehen ist.

Im Konsolen-Log taucht passend dazu `Importing a module script failed` auf — genau dieser Fehler tritt typisch auf Display-/Signage-Browsern auf.

## Lösung

Den `<noscript>`-Block in `/embed/region-lokal` (und `/embed/lokal`) mit **echten, server-seitig vorgerenderten Prognosedaten** für Amriswil füllen. Damit:

- moderne Browser mit funktionierendem JS sehen wie bisher das interaktive Widget (Noscript wird ausgeblendet).
- Browser ohne JS oder mit Chunk-Loading-Fehler zeigen sofort eine lesbare statische Prognose — Aktuell-Block, nächste Stunden, 7-Tage-Übersicht — statt blauer Fläche.
- Kein neuer Endpoint nötig; der bestehende R2-Cache + `getAggregatedForecast` liefert die Daten.

## Änderungen

1. **`src/lib/embed-noscript.server.ts`** (neu)
   - Helper `buildLokalNoscriptDataFor({ name, lat, lon })`:
     - ruft die bestehende Aggregations-Pipeline (Logik aus `getAggregatedForecast`) für Amriswil auf,
     - mappt `ForecastResponse` → `LokalNoscriptData`:
       - `current` aus erster Stunde ab jetzt (Temperatur, Wettercode, Niederschlag, Wind),
       - `hourly` = nächste ~12 Stunden,
       - `daily` = 7 Tage (Min/Max, Wettercode, Niederschlagssumme, Böen-Max),
       - `generatedAt` = jetzt.
     - Bei Fehler/leerem Cache: gibt das bisherige `EMPTY_NOSCRIPT` zurück, damit der Build nie an einer Drittquelle scheitert.
   - Nur server-seitig importierbar (`*.server.ts`).

2. **`src/routes/embed.region-lokal.tsx`**
   - Loader wird async, ruft den neuen Helper auf, gibt `{ noscript }` mit echten Daten zurück.
   - `setEmbedCacheHeaders()` bleibt — CDN-Cache (60 s / SWR 1 h) glättet Last.
   - Keine Komponentenänderung: `<noscript><LokalNoscript data={noscript} /></noscript>` rendert nun realen Inhalt.

3. **`src/routes/embed.lokal.tsx`**
   - Gleiche Loader-Erweiterung, gleiche Daten (Amriswil) — derselbe Mechanismus, damit auch der separate Lokal-Embed nicht leer ist, wenn JS scheitert.

## Was bewusst nicht geändert wird

- Kein Eingriff in `WeatherWidget` oder die JS-Pipeline — das Verhalten für moderne Browser bleibt identisch.
- Kein Eingriff in das Snippet selbst (`embed-info.tsx`) — der blaue Wrapper bleibt als sanfter Lade-Hintergrund.
- Kein neuer öffentlicher API-Endpoint — alles läuft im SSR-Loader.
- Karte (`region-lokal`-Variante mit Radarbild) wird in diesem Schritt **nicht** ergänzt; der Snippet-Name lautet "Lokalprognose Amriswil" und die statische Lokalprognose ist die wichtigste Sichtbarkeits-Garantie. (`RegionLokalNoscript` mit Karte existiert bereits, kann später optional aktiviert werden.)

## Technische Details

- TanStack Start: Loader läuft beim SSR auf dem Cloudflare-Worker → `process.env`/R2-Zugriff über bestehende Server-Helper ist erlaubt.
- `LokalNoscriptData` ist serialisierbar (Strings, Numbers, Nullen) → unbedenklich über die Loader-Grenze.
- Die Mapping-Funktion arbeitet defensiv mit `?? null` und überspringt fehlende Indizes, damit ein partieller Cache nie wirft.
- CDN-Header sorgen dafür, dass der vorgerenderte HTML-Body pro Edge-PoP 60 s frisch bleibt und bis 1 h stale-while-revalidate ausgeliefert wird — keine Latenz-Verschlechterung im Embed.
