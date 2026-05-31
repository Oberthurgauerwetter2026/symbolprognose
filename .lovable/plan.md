## Befund

Die Zeit passt aktuell aus zwei Gründen nicht zuverlässig:

1. **Debug-Endpoint liest die falsche Manifest-URL**  
   `R2_PUBLIC_URL` ist bereits `.../radar/frames.json`, aber `/api/public/debug/r2-cache` hängt nochmals `/radar/frames.json` an. Dadurch zeigt die Diagnose `manifest fetch 404`, obwohl das echte Manifest existiert.

2. **Frontend vermischt Messung, Nowcast und Prognose auf einer durchgehenden Timeline**  
   Nach dem letzten echten Radarbild werden Nowcast-Frames erzeugt, die weiterhin dasselbe letzte Radar-PNG verschoben anzeigen. Für spätere Uhrzeiten sieht es deshalb so aus, als sei das Radarbild zeitlich falsch, weil z. B. 18:20 angezeigt wird, aber visuell noch das 17:55-Radarbild als Grundlage verwendet wird.

3. **Manifest enthält nur den Zeitstempel des Frames, nicht die tatsächliche Bildquelle nach Forward-Fill/Nowcast**  
   Wenn ein Frame eine weiterverwendete `precipUrl` bekommt, ist im UI nicht klar sichtbar, ob das Bild exakt zu dieser Uhrzeit gemessen wurde oder nur von einem früheren Messbild stammt.

## Plan

### 1. R2-Debug-Endpoint reparieren

In `src/routes/api/public/debug/r2-cache.ts` dieselbe robuste URL-Normalisierung wie in `src/lib/radar.functions.ts` verwenden:

- Wenn `R2_PUBLIC_URL` schon auf `radar/frames.json` zeigt, exakt diese URL abrufen.
- Wenn `R2_PUBLIC_URL` nur die Basis-URL ist, `/radar/frames.json` anhängen.
- Zusätzlich `latestFrameTs`, `latestPrecipTs`, `latestPrecipUrl` und deren Alter ausgeben.

Damit kann sofort geprüft werden, ob die Datenquelle aktuell ist.

### 2. Frame-Herkunft im Payload explizit machen

In `src/lib/radar.functions.ts` die Radar-Frames erweitern um:

- `displayT`: Zeit, die auf der Timeline steht.
- `sourceT`: tatsächlicher Zeitstempel des verwendeten Radar-PNGs.
- `isFilled`: true, wenn ein fehlender Frame per Forward-Fill aus älterem Bild gefüllt wurde.
- Für Nowcast: `sourceT` bleibt der letzte echte Radar-Messzeitpunkt, `displayT` ist die Nowcast-Zielzeit.

So kann die UI unterscheiden zwischen „Messung 17:55“ und „Nowcast für 18:20 aus Messung 17:55“.

### 3. Timeline und Labels entwirren

In `src/components/maps/radar-map.tsx`:

- Den „Jetzt“-Button standardmässig auf das **letzte echte Radar-Messbild** setzen, nicht auf einen verschobenen Nowcast-Frame, wenn der Nutzer explizit Messung/Radar kontrollieren will.
- Labels klar formulieren:
  - Echte Messung: `Messung: 17:55 (vor N min)`
  - Gefüllter Messframe: `Messung fehlt · Bild von 17:50`
  - Nowcast: `Nowcast: 18:20 · Basis 17:55`
  - Modell: `Prognose: 19:00`
- Im Badge oben links ebenfalls `Bildbasis ...` anzeigen, sobald `sourceT !== t`.

### 4. Optionalen Schutz gegen falsche alte R2-Frames einbauen

Im Server-Payload Frames verwerfen oder warnen, wenn:

- `precipUrl`-Zeitstempel und Frame-`t` mehr als 5 Minuten auseinanderliegen, ausser es ist explizit Forward-Fill/Nowcast.
- Das neueste echte Radarbild älter als z. B. 20 Minuten ist.

Dann zeigt die UI eine sichtbare Warnung statt scheinbar aktuellem Radar.

## Verifikation

Nach Umsetzung:

1. `/api/public/debug/r2-cache` muss das Manifest ohne 404 lesen.
2. `/karten/radar` muss bei „Jetzt“ das letzte echte Messbild zeigen.
3. Bei Nowcast-Zeiten muss klar sichtbar sein, welches Messbild als Basis genutzt wird.
4. Wenn das Radar-Manifest hinterherhinkt, muss die UI das Alter statt einer falschen Aktualität anzeigen.