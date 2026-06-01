Ich habe die aktuelle Radar-Embed-Performance geprüft: der erste Server-Response dauert ca. 3,7s, der erste Paint ca. 5,3s, und der Radar-Inhalt wartet zusätzlich auf viele JS-Module plus einen `getRadarFrames`-Call. Daher reicht `loading="eager"` allein nicht.

Plan:

1. **Radar-Embed sofort sichtbar machen**
   - In `/embed/radar` die Radar-Daten direkt im Route-Loader laden und als `initialData` an `RadarMap` geben.
   - Dadurch entfällt nach dem JS-Start der zusätzliche `_serverFn/getRadarFrames`-Request im Browser.

2. **Radar-Serverantwort stärker cachen**
   - `getRadarFrames` von `max-age=60` auf längeres CDN-Caching mit `stale-while-revalidate` anheben.
   - Ziel: wiederholte WordPress-Aufrufe sollen nicht jedes Mal auf Radar-/Wetterdaten warten.

3. **Noscript/SSR-Fallback auch ohne deaktiviertes JS sichtbar machen**
   - Den bisherigen Radar-Fallback nicht nur in `<noscript>` verstecken, sondern als leichte Startansicht rendern, bis die Leaflet-Karte geladen ist.
   - Ergebnis: Besucher sehen sofort Inhalt statt leerem/ladendem iframe.

4. **Komplett-Widget vermeiden/entschärfen**
   - Im `/embed/all`-Snippet klar empfehlen, einzelne Karten einzubetten, weil das Tabs-Widget mit RegionMap schwerer ist.
   - Optional im Code: Radar im Komplett-Widget erst laden, wenn der Radar-Tab aktiv ist, statt als ComingSoon/ungenutzte schwere Module früh mitzuziehen.

5. **Prüfen nach Umsetzung**
   - `/embed/radar` und `/embed-info` im Preview messen.
   - Erwartung: sichtbarer erster Inhalt deutlich früher; Radar selbst lädt danach progressiv.