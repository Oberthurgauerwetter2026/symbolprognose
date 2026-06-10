## Ziel

Im Snippet "Lokalprognose Amriswil" (`/api/public/embed/region-lokal-static`) soll die Stundenliste automatisch weiterrutschen, sobald eine Stunde abgelaufen ist – ohne dass jemand die Seite manuell neu lädt und ohne auf den nächsten Cache-Refresh zu warten.

## Aktuelle Situation

- Der Endpoint liefert reines HTML, das im iFrame eingebettet wird.
- Die Stundenzeilen werden serverseitig in `renderStaticForecast()` einmal gerendert (12 Stunden ab "jetzt zur Render-Zeit").
- Cache-Header: `max-age=60, s-maxage=300, stale-while-revalidate=3600`. D. h. die abgelaufene Stunde bleibt teils bis zu 5 Min sichtbar, danach lädt das HTML erst beim nächsten Request neu.
- Es gibt aktuell keinerlei Logik, die "vergangene" Stunden ausblendet.

## Lösung

Zwei kleine, voneinander unabhängige Schritte:

### 1. Mehr Stundenpuffer + Zeitstempel pro Zeile rendern
- In `region-lokal-static.ts` jede `<tr>` der Stundentabelle mit einem `data-hour="<ISO>"`-Attribut versehen (ISO-Start der Stunde).
- Statt nur 12 Stunden ein paar mehr ausliefern (z. B. 18), damit nach dem Wegblenden vergangener Zeilen immer noch ~12 sichtbar bleiben. `MAX_HOURLY` in `embed-noscript.server.ts` entsprechend anheben (oder ein zweiter Wert nur fürs Static-Snippet).
- Zusätzlich eine `data-rendered-at="<ISO>"` am Tabellen-Wrapper.

### 2. Mini-Script im Snippet, das abgelaufene Zeilen ausblendet
- Ein winziges inline `<script>` (~20 Zeilen, kein Bundle, kein Framework) am Ende des HTML:
  - Liest `data-hour` jeder Zeile.
  - Setzt jede Zeile mit `hour + 1h <= now` auf `display:none`.
  - Läuft sofort beim Laden und danach alle 60 s via `setInterval`.
  - Optional: wenn weniger als z. B. 3 sichtbare Zeilen übrig sind, ruft es `location.reload()` auf, damit frische Daten nachgeladen werden.
- Da das Snippet bereits in einem iFrame läuft und JS dort erlaubt ist, ist das unkritisch. Fällt JS aus, bleibt das aktuelle Verhalten (statische 18 Stunden) als Fallback erhalten.

### 3. Cache leicht entschärfen (optional, empfohlen)
- `max-age` von 60 auf 300 belassen ist ok, aber damit die Liste nach Reload auch wirklich neue Stunden enthält: `s-maxage` auf z. B. 600 lassen, `stale-while-revalidate` beibehalten. Keine Änderung an der Caching-Strategie nötig, wenn Schritt 2 den Reload triggert.

## Geänderte Dateien

- `src/lib/embed-noscript.server.ts` – `MAX_HOURLY` erhöhen (z. B. 18) bzw. Parameter zulassen.
- `src/routes/api/public/embed/region-lokal-static.ts`
  - `data-hour` Attribute pro Zeile, `data-rendered-at` am Wrapper.
  - Inline-Script ans Ende vor `</body>`.

## Nicht-Ziele

- Keine Änderung an der 7-Tage-Tabelle.
- Keine Änderung am "Aktuell"-Block (der zeigt ohnehin die jüngste Stationsmessung).
- Keine Änderung an anderen Embeds (`/embed/region-lokal`, `/embed/lokal`), die ohnehin clientseitig live aktualisieren.
