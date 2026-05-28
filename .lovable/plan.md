## Befund

Es wurde etwas geändert, aber nicht an der Stelle, die bei dir offenbar gerade wirkt: Der Wind-Fallback ist korrigiert. Der bevorzugte Radar-Motion-Vektor kommt aber aus der FFT-Phasenkorrelation im Radar-Ingest. Dort ist das Vorzeichen sehr wahrscheinlich noch invertiert. Wenn dieser Radar-Vektor vorhanden ist, wird der Wind-Fallback gar nicht benutzt – deshalb laufen die Zellen weiterhin rückwärts.

Bei ICON-CH1 wurde bisher nur begrenzt verbessert:
- 15-Minuten-Frames werden aus ICON-CH1 genutzt.
- Zwischen stündlichen Ankern gibt es eine Wind-Advection/Smoothing-Interpolation.
- Nowcast und ICON-CH1 werden im Übergang weicher geblendet.

Das ist noch keine echte Qualitätslösung wie bei Wetterdiensten, weil lokale Zellbewegung, Zellwachstum/-zerfall, Plausibilitätskontrolle und Modell-/Radar-Bias noch fehlen.

## Plan

### 1. Rückwärtslauf definitiv beheben

- In `scripts/ingest_radar.py` die FFT-Motion-Richtung korrigieren:
  - entweder `conj(A) * B` statt `A * conj(B)`,
  - oder die zurückgegebenen `dx/dy`-Vorzeichen invertieren.
- Kommentar und Logik so anpassen, dass klar ist:
  - `dx > 0` = Bewegung nach Osten,
  - `dy > 0` = Bewegung nach Süden im Pixelraum,
  - `v_deg_per_min` bleibt geografisch korrekt nach Norden/Süden.
- `RADAR_INGEST_VERSION` und Workflow-Expected-Version erhöhen, damit GitHub Actions sicher die neue Ingest-Version ausführt.
- Motion-Debugwerte im Payload/Frontend sichtbar prüfen: Quelle, Konfidenz, u/v, Frames/Pairs.

### 2. Nowcast stark verbessern

- Statt nur einem globalen Verschiebungsvektor zusätzlich ein grobes lokales Motion-Feld berechnen:
  - blockweise Phasenkorrelation auf Radarblöcken,
  - robuste Median-/IQR-Filter gegen Ausreisser,
  - Fallback auf globalen Vektor bei schwachem Signal.
- Manifest um lokale Bewegungsfelder erweitern, rückwärtskompatibel.
- Frontend-Nowcast von reinem `ImageOverlay`-Bounds-Shift auf Canvas-Advection umstellen:
  - Radar-PNG wird geladen,
  - Pixel werden entlang des lokalen Motion-Felds verschoben,
  - dadurch können Fronten/Zellen unterschiedlich ziehen statt starr als Ganzes.
- Growth/Decay verbessern:
  - nicht nur globale Opacity,
  - sondern Intensität trendabhängig und zeitlich gedämpft anwenden,
  - Übertreibungen klemmen, damit Schauer nicht künstlich explodieren.

### 3. ICON-CH1-Prognose qualitativ verbessern

- ICON-CH1 nicht nur glätten, sondern radar-nah korrigieren:
  - letzte Radarintensität mit ICON-CH1 für gleiche Zeit vergleichen,
  - Bias-Faktor pro Region/Grid-Zelle ableiten,
  - Faktor zeitlich ausblenden: stark bei +0…+2h, schwach danach.
- Übergang Nowcast → ICON-CH1 neu gewichten:
  - Radar/Nowcast dominiert bis ca. +45 min,
  - Mischbereich +45…+120 min,
  - ICON-CH1 übernimmt danach.
- Niederschlagsflächen advectiv interpolieren, aber keine starken Mengen künstlich erzeugen:
  - konservierende Interpolation,
  - Schwellen gegen Niesel-/Pixelrauschen,
  - separate Behandlung Schnee/Regen beibehalten.

### 4. AROME sinnvoll einbinden

- AROME ist aktuell nur in der Symbolprognose-Phase vorhanden, nicht im Radar/ICON-CH1-Radarprodukt.
- Ich erweitere den Cache so, dass AROME auch für die kurzfristige Niederschlagsprognose verfügbar ist, falls die API sie für diese Region/Variablen liefert.
- In der Radar-Prognose wird AROME nicht blind ersetzt, sondern als Qualitätsbeitrag genutzt:
  - ICON-CH1 bleibt Hauptmodell für Schweiz/Ostschweiz,
  - AROME wird als zweiter Niederschlags-Impuls im nahen Ausland/Voralpenumfeld gewichtet,
  - bei Modellkonflikten gewinnt Radar/Nowcast in den ersten 1–2 Stunden.

### 5. Validierung

- Eine kleine Richtungstest-Logik/Smoke-Check für die Phasenkorrelation ergänzen, damit dieser 180°-Fehler nicht wiederkommt.
- Nach Umsetzung prüfen:
  - Motion-Vektor zeigt zur realen Zellverlagerung,
  - Nowcast-Frames bewegen sich vorwärts,
  - ICON-CH1-Frames starten nicht abrupt/hart nach dem Radar,
  - Manifest enthält neue Motion-/Qualitätsdaten.

## Ergebnis

Nach Umsetzung ist der Rückwärtslauf an der eigentlichen Ursache behoben. Zusätzlich wird der Nowcast von einer einfachen starren Bildverschiebung zu einem radar-nahen, lokal bewegten und modellkorrigierten Kurzfristprodukt ausgebaut.