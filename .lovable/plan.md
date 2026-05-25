## Plan

Ich passe nur das Radar-Ingest-Skript an.

### Ursache
Die MeteoSchweiz-Dateinamen enthalten Zeitstempel wie:

```text
cpc261451220vl.801.h5
bzc261451245vl.845.h5
```

Das aktuelle Regex erwartet nach Stunde und Minute noch einen Unterstrich (`_`). Bei den aktuellen Dateien steht dort aber oft `vl` oder eine andere Endung. Dadurch kann `parse_ts_from_filename()` keinen Zeitstempel lesen und alle Assets werden verworfen → `0 candidate frames`.

### Umsetzung
1. Regex für Radar-Dateinamen robuster machen:
   - Prefix: `cpc`, `bzc`, etc.
   - Jahr: `26`
   - Tag-im-Jahr: `145`
   - Uhrzeit: `HHMM`
   - Danach beliebige Produkt-Endung erlauben (`_`, `vl`, `.`, etc.)
2. Kleine Diagnose-Ausgabe ergänzen, wenn ein Tages-Item Assets enthält, aber kein einziger Zeitstempel parsebar ist.
3. Optional den Workflow so erweitern, dass `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` gesetzt ist, damit die GitHub-Warnung zu Node 20 verschwindet.

### Erwartetes Ergebnis
Beim nächsten manuellen Workflow-Start sollten im Log statt `0 candidate frames` mehrere Frames erscheinen, z. B.:

```text
== precip ... ==
  XX candidate frames
...
manifest: XX frames
```

Danach sollte `frames.json` Einträge enthalten und `/karten/radar` Bilder anzeigen.