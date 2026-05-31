## Ziel

Die interne Seite `/intern/niederschlag` (akkumulierter Niederschlag) vom Wetter-Board (Startseite) aus erreichbar machen, damit alle Karten zentral griffbereit sind.

## Umsetzung

**`src/lib/maps-config.ts`**
- Neuen Eintrag `niederschlag` zu `MAPS` hinzufügen:
  - `id: "niederschlag"`, `label: "Niederschlagssummen (intern)"`, `shortLabel: "Niederschlag"`
  - `description: "Akkumulierter Niederschlag der letzten Stunden – stündliche Aktualisierung."`
  - `icon: CloudRainWind` (oder `Droplets`) aus lucide-react
  - `routePath: "/intern/niederschlag"`, `embedPath` entfällt
  - `status: "live"`
- `MapId` Typ und Embed-Pfade so erweitern, dass der intern-Eintrag ohne Embed funktioniert (entweder `embedPath` optional machen oder Dummy-Wert mit Sonderbehandlung).

**`src/routes/index.tsx`**
- Bei der `MAPS.map(...)`-Kachelliste eine kleine "Intern"-Markierung anzeigen (z. B. Badge statt "Live"), wenn `routePath` mit `/intern` startet.
- Link führt direkt auf `/intern/niederschlag` (Passwortabfrage bleibt dort bestehen).

**Sidebar/Tabs (optional, falls sie ebenfalls `MAPS` benutzen)**
- Prüfen, ob `src/components/app-sidebar.tsx` und `src/components/map-tabs.tsx` den neuen Eintrag automatisch zeigen. Wenn ja: interne Einträge dort herausfiltern, damit sie nur auf dem Board erscheinen (kein Embed-Snippet, keine öffentliche Tab-Leiste).

## Nicht enthalten
- Keine Änderung an der Karte selbst, an der Aktualisierungslogik oder am Login.
- Kein öffentliches Embed für die interne Karte.
