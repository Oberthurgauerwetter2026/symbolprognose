## Diagnose

Der Screenshot zeigt **GitHub Actions Repository Secrets**. Diese werden nur an den GitHub-Workflow übergeben.

Die App selbst liest das Manifest aber serverseitig hier:

```ts
const base = process.env.R2_PUBLIC_URL;
if (!base) return null;
```

In den Lovable-Laufzeit-Secrets ist aktuell nur `LOVABLE_API_KEY` vorhanden. Das heißt: Für die laufende App fehlt `R2_PUBLIC_URL`, daher kann sie `radar/frames.json` nie laden und fällt weiterhin auf Open-Meteo/Fallback zurück.

## Plan

1. **Lovable Runtime-Secret hinzufügen**
   - In Lovable ein Secret `R2_PUBLIC_URL` anlegen.
   - Wert muss derselbe sein wie in GitHub: die öffentliche Basis-URL deines R2-Buckets, ohne `/radar/frames.json` am Ende.

2. **Radar-Serverfunktion prüfen**
   - Danach die Radar-Datenfunktion erneut aufrufen.
   - Erwartung: `hasRealRadar: true`, sobald `frames.json` Frames enthält.

3. **Falls `hasRealRadar` weiterhin false bleibt**
   - Dann ist der Workflow/Manifest-Inhalt das Problem, nicht mehr die App-Verbindung.
   - Dann prüfen wir den zuletzt erzeugten `radar/frames.json` direkt über `R2_PUBLIC_URL/radar/frames.json`.

4. **Kleine Absicherung im Code**
   - Optional: `getRadarFrames` soll im Server-Log klar melden, wenn `R2_PUBLIC_URL` fehlt oder das Manifest nicht geladen werden kann. So ist dieser Fehler künftig sofort sichtbar.

## Wichtig

Die R2-Zugangsdaten (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`) braucht nur GitHub Actions für den Upload. Die App braucht für die Anzeige nur `R2_PUBLIC_URL`.